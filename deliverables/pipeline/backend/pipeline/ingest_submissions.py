#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
검수 완료(approved) 이용자 지식 제안 → 지식 스키마 문서로 반영 → 재인덱싱.

입력: 프론트 GET /api/knowledge?status=approved 응답을 저장한 JSON.
동작:
  1) 각 제안을 자연어 지식 문서 1건으로 변환
  2) data/processed/user_knowledge.jsonl 에 append (원본 CSV/POI는 건드리지 않음)
  3) build_index 로 해당 컬렉션에 재인덱싱(증분) 안내 출력/실행

사용:
    python backend/pipeline/ingest_submissions.py --submissions approved.json \
        --out data/processed/user_knowledge.jsonl --reindex
"""
import argparse, json, os, subprocess, sys, datetime

def to_document(sub: dict) -> dict:
    """지식 문서화 규칙(kb_schema.md와 동일 취지): 이름·카테고리·내용을 한 문장으로."""
    name = sub.get("targetName") or sub.get("target_name") or "미상"
    cat = sub.get("category") or "일반"
    content = (sub.get("content") or "").strip()
    text = f"{name}({cat}) 관련 이용자 제공 정보: {content}"
    return {
        "doc_id": f"user-{sub.get('id')}",
        "source": "user_submission",
        "name": name,
        "category_norm": cat,
        "document": text,
        "content": content,
        "ingested_at": None,  # 배치 실행 시각은 호출부에서 채움(재현성)
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--submissions", required=True, help="approved 제안 JSON (배열 또는 {submissions:[...]})")
    ap.add_argument("--out", default="data/processed/user_knowledge.jsonl")
    ap.add_argument("--reindex", action="store_true", help="append 후 build_index 재인덱싱 실행")
    ap.add_argument("--collection", default="poi")  # rag_service의 COLLECTION_NAME과 일치
    ap.add_argument("--ts", default=None, help="ingested_at 타임스탬프(ISO). 미지정 시 현재 시각")
    a = ap.parse_args()

    data = json.load(open(a.submissions, encoding="utf-8"))
    subs = data.get("submissions", data) if isinstance(data, dict) else data
    ts = a.ts or datetime.datetime.now().isoformat(timespec="seconds")

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    n = 0
    with open(a.out, "a", encoding="utf-8") as f:
        for sub in subs:
            doc = to_document(sub)
            doc["ingested_at"] = ts
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            n += 1
    print(f"[ingest] {n}건 → {a.out}")

    if a.reindex:
        # build_index.py가 --jsonl/--collection 인자를 지원하도록 확장하거나, 아래처럼 호출.
        cmd = [sys.executable, "backend/build_index.py", "--jsonl", a.out, "--collection", a.collection, "--append"]
        print("[ingest] 재인덱싱:", " ".join(cmd))
        try:
            subprocess.run(cmd, check=True)
        except Exception as e:
            print(f"[ingest] 재인덱싱은 build_index 확장 후 실행하세요 (증분 add). 상세: {e}")

if __name__ == "__main__":
    main()
