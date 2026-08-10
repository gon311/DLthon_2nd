"""POI 수집·정제 파이프라인 (M1 담당)

노트북(jeju_pois_standardized_json)을 스크립트로 변환한 것.
카카오 로컬 API에서 숙소 주변 POI를 수집하고, api_contract 스키마로 변환한 뒤,
최근접 버스정류장을 매핑하여 data/processed/ 에 저장한다.

실행 (레포 루트 기준):
    python -m data.scripts.collect_pois

필요 환경변수 (.env):
    KAKAO_API_KEY   카카오 REST API 키
    LODGING_LAT     숙소 위도
    LODGING_LNG     숙소 경도
"""

import json
import sys 
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()  # ← 추가

# 레포 루트를 Python 경로에 추가 (data/scripts/collect_pois.py -> data -> . 루트)
repo_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(repo_root))

# 거리 계산 + 좌표는 backend/utils/geo.py 의 단일 정의를 사용
from backend.utils.geo import haversine_m, LODGING_LAT, LODGING_LNG

import os
KAKAO_API_KEY = os.environ["KAKAO_API_KEY"]
HEADERS = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}

CATEGORY_URL = "https://dapi.kakao.com/v2/local/search/category.json"
KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

# api_contract 카테고리 매핑
CATEGORY_MAP = {
    "FD6": "restaurant", "CE7": "cafe", "AT4": "attraction",
    "AD5": "accommodation", "PK6": "parking", "PM9": "pharmacy",
    "BK9": "bank", "HP8": "hospital", "SW8": "subway",
}
KEYWORD_CATEGORY_MAP = {
    "버스정류장": "bus_stop", "편의점": "convenience_store", "주차장": "parking",
}

DATA_RAW = Path("data/raw")
DATA_PROCESSED = Path("data/processed")


# ---------------------------------------------------------------
# 1. 수집 — 페이징 로직은 하나로 통합 (기존 셀 1·3·4 통합)
# ---------------------------------------------------------------
def _search_paged(url: str, params: dict, max_pages: int = 45) -> list[dict]:
    """카카오 로컬 검색을 전 페이지 순회하며 수집한다."""
    docs = []
    for page in range(1, max_pages + 1):
        resp = requests.get(url, headers=HEADERS, params={**params, "page": page}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        batch = data.get("documents", [])
        docs.extend(batch)
        if data.get("meta", {}).get("is_end") or not batch:
            break
        time.sleep(0.2)  # 호출 제한 회피
    return docs


def search_by_category(category_code: str, radius: int = 500) -> list[dict]:
    return _search_paged(CATEGORY_URL, {
        "category_group_code": category_code,
        "x": LODGING_LNG, "y": LODGING_LAT,
        "radius": radius, "size": 15, "sort": "distance",
    })


def search_by_keyword(keyword: str, radius: int = 500) -> list[dict]:
    return _search_paged(KEYWORD_URL, {
        "query": keyword,
        "x": LODGING_LNG, "y": LODGING_LAT,
        "radius": radius, "size": 15, "sort": "distance",
    })


# ---------------------------------------------------------------
# 2. 변환 — api_contract 스키마 (기존 셀 5)
# ---------------------------------------------------------------
def transform_to_contract_format(kakao_docs: list[dict], fallback_category: str | None = None) -> list[dict]:
    # ISO 8601 (utcnow()는 deprecated → timezone-aware 사용)
    current_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = []
    for doc in kakao_docs:
        category = CATEGORY_MAP.get(doc.get("category_group_code")) \
            or KEYWORD_CATEGORY_MAP.get(fallback_category, "other")
        out.append({
            "id": doc.get("id"),
            "name": doc.get("place_name"),
            "category": category,
            "latitude": float(doc.get("y")),
            "longitude": float(doc.get("x")),
            "description": "",  # RAG 단계에서 채움
            "source": "kakao_local",
            "created_at": current_time,
        })
    return out


# ---------------------------------------------------------------
# 3. 최근접 정류장 매핑 (기존 셀 7~8, iterrows → 벡터화)
# ---------------------------------------------------------------
def attach_nearest_stops(poi_df: pd.DataFrame, bus_csv: Path) -> pd.DataFrame:
    """각 POI에 최근접 버스정류장 3개 컬럼(nearest_stop_name, stop_lat, stop_lng)을 붙인다."""
    bus_df = pd.read_csv(bus_csv)
    
    def nearest(row):
        # 각 POI마다 모든 버스정류장과의 거리를 계산
        distances = []
        for idx, bus in bus_df.iterrows():
            d = haversine_m(row["latitude"], row["longitude"], bus["위도"], bus["경도"])
            distances.append(d)
        
        # 최소 거리 인덱스 찾기
        nearest_idx = int(np.argmin(distances))
        nearest_bus = bus_df.iloc[nearest_idx]
        
        return pd.Series({
            "nearest_stop_name": nearest_bus["정류장명"],
            "stop_lat": nearest_bus["위도"],
            "stop_lng": nearest_bus["경도"],
        })

    return poi_df.join(poi_df.apply(nearest, axis=1))


# ---------------------------------------------------------------
# 실행
# ---------------------------------------------------------------
def main() -> None:
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)

    # 1) 수집: 카테고리(음식점 등) + 키워드(인프라)
    all_pois: list[dict] = []

    # ✅ 음식점 — 500m (도보권 집중)
    restaurants = search_by_category("FD6", radius=500)
    all_pois += transform_to_contract_format(restaurants)
    print(f"✓ 음식점 {len(restaurants)}개 수집")

    # ✅ 관광명소 — 1500m (반경 확대)
    attractions = search_by_category("AT4", radius=1500)
    all_pois += transform_to_contract_format(attractions)
    print(f"✓ 관광명소(AT4) {len(attractions)}개 수집")

    # ✅ 문화시설 — 1500m (반경 확대)
    culture = search_by_category("CT1", radius=1500)
    all_pois += transform_to_contract_format(culture)
    print(f"✓ 문화시설(CT1) {len(culture)}개 수집")

    # 키워드 검색 (인프라)
    for keyword in ("편의점", "주차장"):
        docs = search_by_keyword(keyword, radius=500)
        all_pois += transform_to_contract_format(docs, fallback_category=keyword)
        print(f"✓ {keyword} {len(docs)}개 수집")

    # 2) 중복 제거
    df = pd.DataFrame(all_pois).drop_duplicates(subset=["id"], keep="first")

    # 3) 최근접 정류장 매핑
    df = attach_nearest_stops(df, DATA_RAW / "jeju_bus_stations.csv")

    # 4) 저장 — created_at 을 ISO 문자열 그대로 유지하기 위해 to_json 대신 json.dump 사용
    out_path = DATA_PROCESSED / "guesthouse_pois.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(df.to_dict(orient="records"), f, ensure_ascii=False, indent=2)

    print(f"🎉 저장 완료: {out_path} (총 {len(df)}개)")


if __name__ == "__main__":
    main()