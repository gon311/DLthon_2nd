"""
지식베이스 구축 스크립트
- 입력: POI CSV (poi_id, name, category_raw, category_norm, lat, lng,
        nearest_stop_name, stop_lat, stop_lng, source, description)
- 처리: utils/geo.py로 거리(distance_m, stop_distance_m) 계산
        → kb_schema.md 템플릿대로 문서 텍스트 생성 → OpenAI Embeddings 배치 호출
        → ChromaDB persistent 인덱스에 저장
- 출력: data/index/chroma/ (인덱스 파일, 7/31 종료 시 커밋 대상)

사용법:
    export OPENAI_API_KEY=...
    python build_index.py --csv sample_poi.csv --collection poi
    python build_index.py --csv sample_poi.csv --collection poi --smoke-test
"""

import argparse
import csv
import os

import chromadb
from openai import OpenAI

from utils.geo import distance_from_lodging_m, haversine_m

EMBED_MODEL = "text-embedding-3-small"
INDEX_DIR = "data/index/chroma"

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]


def build_document_text(row: dict, distance_m: int, stop_distance_m: int | None) -> str:
    """kb_schema.md의 본문 템플릿을 그대로 적용."""
    lines = [
        f"{row['name']}은(는) {row['category_norm']}으로, "
        f"{row.get('description', '')}. "  # ← description 추가
        f"숙소에서 약 {distance_m}m 거리에 있다.",
    ]
    if stop_distance_m is not None and stop_distance_m <= 300:
        lines.append(
            f"인근 정류장: {row['nearest_stop_name']}, "
            f"도보 약 {stop_distance_m}m."
        )
    return " ".join(lines)


def load_rows(csv_path: str) -> list[dict]:
    with open(csv_path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def embed_documents(client: OpenAI, texts: list[str]) -> list[list[float]]:
    # 배치 호출: 건별 호출 금지 (비용/속도)
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in resp.data]


def build_index(csv_path: str, collection_name: str, client: OpenAI) -> None:
    rows = load_rows(csv_path)

    documents = []
    metadatas = []
    for r in rows:
        distance_m = distance_from_lodging_m(float(r["lat"]), float(r["lng"]))
        stop_distance_m = None
        if r.get("stop_lat") and r.get("stop_lng"):
            stop_distance_m = haversine_m(
                float(r["lat"]), float(r["lng"]), float(r["stop_lat"]), float(r["stop_lng"])
            )

        documents.append(build_document_text(r, distance_m, stop_distance_m))
        metadatas.append(
            {
                "name": r["name"],
                "category_norm": r["category_norm"],
                "distance_m": distance_m,
                "source": r["source"],
                "solo_friendly": r.get("solo_friendly", ""),  
            }
        )

    client = OpenAI()
    vectors = embed_documents(client, documents)

    chroma = chromadb.PersistentClient(path=INDEX_DIR)
    collection = chroma.get_or_create_collection(collection_name)

    collection.upsert(
        ids=[r["poi_id"] for r in rows],
        embeddings=vectors,
        documents=documents,
        metadatas=metadatas,
    )
    print(f"인덱싱 완료: {len(rows)}건 -> {INDEX_DIR}/{collection_name}")


def smoke_test(collection_name: str, query: str, client: OpenAI) -> None:
    client = OpenAI()
    chroma = chromadb.PersistentClient(path=INDEX_DIR)
    collection = chroma.get_collection(collection_name)

    query_vec = embed_documents(client, [query])[0]
    result = collection.query(query_embeddings=[query_vec], n_results=3)

    print(f"쿼리: {query}")
    for doc, meta in zip(result["documents"][0], result["metadatas"][0]):
        print(f"  - [{meta['category_norm']}, {meta['distance_m']}m] {doc}")


if __name__ == "__main__":
    if not OPENAI_API_KEY:
        raise SystemExit("OPENAI_API_KEY 환경변수가 필요합니다.")

    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--collection", default="poi_demo")
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()

    client = OpenAI(api_key=OPENAI_API_KEY)
    
    build_index(args.csv, args.collection, client)

    if args.smoke_test:
        for q in ["숙소 근처 혼밥 가능한 식당", "도보 관광 코스 추천", "숙소에서 가장 가까운 편의점"]:
            smoke_test(args.collection, q, client)
