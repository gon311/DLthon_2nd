"""
숙소(버킷제주) 자체의 최근접 정류장 문서를 ChromaDB 인덱스에 추가

배경:
  - QA-02 "게스트하우스와 가장 가까운 정류장은 어디인가요?"가 실패하는 이유는
    정류장 정보가 각 POI(식당 등) 문서에 "인근 정류장" 부가 필드로만 존재하고,
    "숙소 자체"의 최근접 정류장을 답하는 독립 문서가 없기 때문.
  - 이 값은 attach_nearest_stops() 단계에서 이미 계산 가능한 결정론적 값이므로
    벡터 검색에 맡기지 않고 문서 1개로 명시적으로 만들어 인덱스에 추가한다.

실행: python -m backend.utils.add_lodging_stop_doc

주의:
  - 기존 POI 재임베딩 없이 이 문서 1개만 추가/업데이트한다 (collection.upsert 사용).
  - LODGING_LAT/LNG, haversine_m은 backend/utils/geo.py의 기존 정의를 그대로 재사용한다 (중복 정의 금지 원칙).
  - 버스정류장 CSV의 실제 컬럼명은 프로젝트마다 다를 수 있으므로, 아래 CSV_COLUMNS 부분을
    jeju_bus_stations.csv 실제 헤더에 맞게 확인 후 조정 필요.
"""

import pandas as pd
import chromadb
from openai import OpenAI

# 프로젝트 공용 모듈 재사용 (단일 정의 원칙 준수)
from .geo import haversine_m, LODGING_LAT, LODGING_LNG

# ── 설정 ────────────────────────────────────────────────────────────
INDEX_DIR = "data/index/chroma"          # build_index.py와 동일 경로여야 함
COLLECTION_NAME = "poi"                   # build_index.py와 동일 컬렉션명이어야 함
BUS_STATIONS_CSV = "data/raw/jeju_bus_stations.csv"  # 확인 완료 (2026-08-10)

# CSV 실제 컬럼명 (jeju_bus_stations.csv 헤더 확인 완료: 정류장번호,정류장명,위도,경도,정보수집일,모바일단축번호,도시코드,도시명,관리도시명)
CSV_COLUMNS = {
    "name": "정류장명",   # 정류장 이름 컬럼
    "lat": "위도",
    "lng": "경도",
}

DOC_ID = "lodging_nearest_stop"  # 고정 ID → 재실행 시 upsert로 덮어씀 (중복 방지)


def find_nearest_stop() -> dict:
    """숙소(LODGING_LAT/LNG) 기준 가장 가까운 정류장 계산"""
    df = pd.read_csv(BUS_STATIONS_CSV)

    name_col = CSV_COLUMNS["name"]
    lat_col = CSV_COLUMNS["lat"]
    lng_col = CSV_COLUMNS["lng"]

    df["distance_m"] = df.apply(
        lambda row: haversine_m(
            LODGING_LAT, LODGING_LNG, row[lat_col], row[lng_col]
        ),
        axis=1,
    )

    nearest = df.loc[df["distance_m"].idxmin()]
    return {
        "name": nearest[name_col],
        "distance_m": round(nearest["distance_m"]),
        "lat": nearest[lat_col],
        "lng": nearest[lng_col],
    }


def build_document_text(stop: dict) -> str:
    """rag_service가 기존 POI 문서와 동일한 스타일로 인식하도록 문서 텍스트 구성"""
    walk_min = round(stop["distance_m"] / 67)  # 도보 약 67m/분 가정, 필요시 조정
    return (
        f"버킷 제주 게스트하우스에서 가장 가까운 대중교통 정류장은 "
        f"{stop['name']}이며, 숙소에서 약 {stop['distance_m']}m "
        f"(도보 약 {walk_min}분) 거리에 있다."
    )


def main():
    print("[1/4] 최근접 정류장 계산 중...")
    stop = find_nearest_stop()
    print(f"  → {stop['name']} ({stop['distance_m']}m)")

    print("[2/4] 문서 텍스트 생성 중...")
    doc_text = build_document_text(stop)
    print(f"  → {doc_text}")

    print("[3/4] 임베딩 생성 중...")
    client = OpenAI()
    embedding = (
        client.embeddings.create(
            model="text-embedding-3-small", input=doc_text
        )
        .data[0]
        .embedding
    )

    print("[4/4] ChromaDB에 추가 중 (기존 인덱스 재사용, 1개 문서만 upsert)...")
    chroma_client = chromadb.PersistentClient(path=INDEX_DIR)
    collection = chroma_client.get_collection(COLLECTION_NAME)

    collection.upsert(
        ids=[DOC_ID],
        documents=[doc_text],
        embeddings=[embedding],
        metadatas=[{
            "category": "정류장",
            "poi_name": stop["name"],
            "distance_m": stop["distance_m"],
        }],
    )

    print("\n✓ 완료. 기존 POI는 그대로, 이 문서 1개만 추가/갱신됨.")
    print(f"  컬렉션 총 문서 수: {collection.count()}")


if __name__ == "__main__":
    main()
