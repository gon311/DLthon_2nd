"""
지식베이스 구축 스크립트 (v2: 숙소 FAQ 통합)
- 입력: POI CSV + 숙소 FAQ JSON
- 처리: 
  1. POI CSV 로드 → 거리 계산 → 문서 텍스트 생성 (기존)
  2. 숙소 FAQ JSON 로드 → FAQ별 문서 텍스트 생성 (신규)
  3. 전체 통합 임베딩 → ChromaDB 저장
- 출력: data/index/chroma/ (POI + 숙소정보 혼합)

사용법:
    export OPENAI_API_KEY=...
    python backend/uild_index.py --csv data/processed/guesthouse_pois.csv --collection poi --faq data/processed/guesthouse_faq.json
    python backend/build_index.py --csv data/processed/guesthouse_pois.csv --collection poi --faq data/processed/guesthouse_faq.json --smoke-test
"""

import argparse
import csv
import json
import os

import chromadb
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

from utils.geo import distance_from_lodging_m, haversine_m

EMBED_MODEL = "text-embedding-3-small"
INDEX_DIR = "data/index/chroma"

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]


def build_document_text(row: dict, distance_m: int, stop_distance_m: int | None) -> str:
    """kb_schema.md의 본문 템플릿을 그대로 적용. (POI용)"""
    lines = [
        f"{row['name']}은(는) {row['category_norm']}으로, "
        f"{row.get('description', '')}. "
        f"숙소에서 약 {distance_m}m 거리에 있다.",
    ]
    if stop_distance_m is not None and stop_distance_m <= 300:
        lines.append(
            f"인근 정류장: {row['nearest_stop_name']}, "
            f"도보 약 {stop_distance_m}m."
        )
    return " ".join(lines)


def build_guesthouse_faq_text(faq: dict, guesthouse_name: str) -> str:
    """숙소 FAQ 문서 텍스트 생성."""
    lines = [
        f"[{guesthouse_name}] {faq['category']}",
        f"Q: {faq['question']}",
        f"A: {faq['answer']}",
    ]
    if faq.get('location'):
        lines.append(f"위치: {faq['location']}")
    if faq.get('available_hours'):
        lines.append(f"운영시간: {faq['available_hours']}")
    if faq.get('price_krw') is not None:
        lines.append(f"가격: {faq['price_krw']:,}원")
    
    return " | ".join(lines)


def load_rows(csv_path: str) -> list[dict]:
    """CSV 파일 로드."""
    with open(csv_path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_guesthouse_faq(json_path: str) -> tuple[list[dict], str]:
    """
    숙소 FAQ JSON 로드.
    Returns:
        (faq_rows_list, guesthouse_name)
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    guesthouse_name = data['guesthouse']['name_ko']
    faq_list = data.get('faq', [])
    
    # FAQ를 POI row와 유사한 구조로 변환
    faq_rows = []
    for faq in faq_list:
        faq_rows.append({
            'poi_id': faq['id'],
            'name': faq['question'],
            'category_norm': faq['category'],
            'type': 'guesthouse_info',
            'guesthouse_name': guesthouse_name,
            'faq': faq,
            'distance_m': 0,  # 숙소 내 정보이므로 거리는 0
            'solo_friendly': True,  # 모든 투숙객이 활용 가능
        })
    
    # 숙소 기본 정보도 추가
    guesthouse_info = {
        'poi_id': 'GH-INFO',
        'name': guesthouse_name,
        'category_norm': '숙소정보',
        'type': 'guesthouse_info',
        'guesthouse_name': guesthouse_name,
        'is_summary': True,
        'distance_m': 0,
        'solo_friendly': True,
    }
    faq_rows.append(guesthouse_info)
    
    return faq_rows, guesthouse_name


def build_guesthouse_summary_text(data: dict) -> str:
    """숙소 기본 정보 문서 생성."""
    guesthouse = data['guesthouse']
    summary = data.get('summary', {})
    
    lines = [
        f"숙소명: {guesthouse['name_ko']}",
        f"주소: {guesthouse['address']}",
        f"구역: {guesthouse['area']}",
        f"공용공간 운영시간: {summary.get('common_area_hours', 'N/A')}",
        f"상시 이용시설: {', '.join(summary.get('always_available', []))}",
        f"무료 편의시설: {', '.join(summary.get('free_facilities', []))}",
    ]
    
    if summary.get('paid_services'):
        paid_items = [f"{s['item']} ({s['price_krw']:,}원)" for s in summary['paid_services']]
        lines.append(f"유료 서비스: {', '.join(paid_items)}")
    
    return " | ".join(lines)


def embed_documents(client: OpenAI, texts: list[str]) -> list[list[float]]:
    """배치 임베딩 호출."""
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def build_index(
    csv_path: str,
    collection_name: str,
    client: OpenAI,
    faq_path: str | None = None
) -> None:
    """
    지식베이스 구축: POI + 숙소 FAQ 통합.
    """
    # Step 1: POI 로드 및 문서 생성
    poi_rows = load_rows(csv_path)
    
    documents = []
    ids = []
    metadatas = []
    
    print(f"📍 POI 처리 중: {len(poi_rows)}건")
    for r in poi_rows:
        distance_m = distance_from_lodging_m(float(r["lat"]), float(r["lng"]))
        stop_distance_m = None
        if r.get("stop_lat") and r.get("stop_lng"):
            stop_distance_m = haversine_m(
                float(r["lat"]), float(r["lng"]), float(r["stop_lat"]), float(r["stop_lng"])
            )

        documents.append(build_document_text(r, distance_m, stop_distance_m))
        ids.append(r["poi_id"])
        metadatas.append({
            "name": r["name"],
            "category_norm": r["category_norm"],
            "distance_m": distance_m,
            "source": r["source"],
            "solo_friendly": r.get("solo_friendly", ""),
            "type": "poi",
        })

    # Step 2: 숙소 FAQ 로드 및 문서 생성 
    if faq_path and os.path.exists(faq_path):
        print(f"🏠 숙소 FAQ 처리 중: {faq_path}")
        faq_rows, guesthouse_name = load_guesthouse_faq(faq_path)
        
        # FAQ 문서들
        for faq_row in faq_rows:
            if faq_row.get('is_summary'):
                # 숙소 기본 정보 문서
                with open(faq_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                doc_text = build_guesthouse_summary_text(data)
            else:
                # 각 FAQ 문서
                doc_text = build_guesthouse_faq_text(
                    faq_row['faq'],
                    faq_row['guesthouse_name']
                )
            
            documents.append(doc_text)
            ids.append(faq_row['poi_id'])
            metadatas.append({
                "name": faq_row['name'],
                "category_norm": faq_row['category_norm'],
                "distance_m": 0,
                "source": "guesthouse_faq",
                "solo_friendly": True,
                "type": "guesthouse_info",
            })
        
        print(f"✅ 숙소 정보 {len(faq_rows)}건 추가")

    # Step 2.5: 숙소 최근접 정류장 문서 추가 (add_lodging_stop_doc 활용)
    # 현재는 타켓 숙소가 하나지만, 타겟 숙소가 늘어나게 된다면 수정 필요 
    try:
        from utils.add_lodging_stop_doc import find_nearest_stop, build_document_text as stop_doc_text_builder
        
        nearest_stop = find_nearest_stop()
        stop_doc_text = stop_doc_text_builder(nearest_stop)
        
        documents.append(stop_doc_text)
        metadatas.append({
            "category": "정류장",
            "poi_name": nearest_stop["name"],
            "distance_m": nearest_stop["distance_m"],
            "type": "poi" 
        })
        ids.append("lodging_nearest_stop")
        print("✅ 타겟 숙소 최근접 정류장 문서 1건 추가 완료")
    except ImportError as e:
         print(f"⚠️ 정류장 모듈을 불러올 수 없습니다. 추가를 건너뜁니다: {e}")    

    # Step 3: 일괄 임베딩
    print(f"🔤 임베딩 중: {len(documents)}건 (배치 호출)")
    vectors = embed_documents(client, documents)

    # Step 4: ChromaDB 저장
    chroma = chromadb.PersistentClient(path=INDEX_DIR)
    collection = chroma.get_or_create_collection(collection_name)

    collection.upsert(
        ids=ids,
        embeddings=vectors,
        documents=documents,
        metadatas=metadatas,
    )
    print(f"✅ 인덱싱 완료: {len(documents)}건 -> {INDEX_DIR}/{collection_name}")
    print(f"   - POI: {len(poi_rows)}건")
    if faq_path and os.path.exists(faq_path):
        print(f"   - 숙소정보: {len(faq_rows)}건")


def smoke_test(collection_name: str, query: str, client: OpenAI) -> None:
    """검색 테스트."""
    chroma = chromadb.PersistentClient(path=INDEX_DIR)
    collection = chroma.get_collection(collection_name)

    query_vec = embed_documents(client, [query])[0]
    result = collection.query(query_embeddings=[query_vec], n_results=3)

    print(f"\n🔍 쿼리: '{query}'")
    for i, (doc, meta) in enumerate(zip(result["documents"][0], result["metadatas"][0]), 1):
        doc_preview = doc[:80] + "..." if len(doc) > 80 else doc
        print(f"  {i}. [{meta['type']}|{meta['category_norm']}] {doc_preview}")


if __name__ == "__main__":
    if not OPENAI_API_KEY:
        raise SystemExit("OPENAI_API_KEY 환경변수가 필요합니다.")

    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="POI CSV 파일 경로")
    parser.add_argument("--collection", default="poi", help="ChromaDB collection 이름")
    parser.add_argument("--faq", default=None, help="숙소 FAQ JSON 파일 경로 (옵션)")
    parser.add_argument("--smoke-test", action="store_true", help="테스트 쿼리 실행")
    args = parser.parse_args()

    client = OpenAI(api_key=OPENAI_API_KEY)
    
    build_index(args.csv, args.collection, client, faq_path=args.faq)

    if args.smoke_test:
        test_queries = [
            "숙소 근처 혼밥 가능한 식당",
            "도보 관광 코스 추천",
            "와이파이 비밀번호",
            "세탁기 사용 가능한가요",
            "공용공간 운영시간",
        ]
        for q in test_queries:
            smoke_test(args.collection, q, client)
