#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
질의 로그 분석 → 지식 커버리지 갭 리포트.

입력: query_logs (프론트 GET /api/query-logs 응답의 logs 배열을 저장한 JSON,
      또는 D1 export). 형식: [{question, answered, confidence, fallback, feedback, ...}, ...]
출력: gap_report.json / gap_report.md
      - 미충족 질문(폴백/저신뢰/도움안됨)을 정규화·집계
      - 자주 나오는 미충족 주제 = 지식 스키마 보강 후보

사용:
    python backend/pipeline/analyze_query_logs.py --logs query_logs.json \
        --conf-threshold 0.5 --out-dir data/eval
"""
import argparse, json, re, os
from collections import Counter

STOP = set("나 너 지금 근처 여기 있어 있나 있을까 어디 어디야 뭐 좀 거 데 하고 하려고 알려줘 해줘 되나 되나요 있나요 어떻게 무엇 인가요".split())

def norm(q: str) -> str:
    q = re.sub(r"[^0-9A-Za-z가-힣\s]", " ", q or "")
    toks = [t for t in q.split() if t and t not in STOP and len(t) >= 2]
    return " ".join(toks)

def is_unmet(r: dict, conf_th: float) -> bool:
    if r.get("fallback"): return True
    if r.get("answered") is False: return True
    c = r.get("confidence")
    if isinstance(c, (int, float)) and c < conf_th: return True
    if r.get("feedback") == "not_helpful": return True
    return False

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--logs", required=True, help="query_logs JSON (배열 또는 {logs:[...]})")
    ap.add_argument("--conf-threshold", type=float, default=0.5)
    ap.add_argument("--out-dir", default=".")
    ap.add_argument("--top", type=int, default=20)
    a = ap.parse_args()

    data = json.load(open(a.logs, encoding="utf-8"))
    rows = data.get("logs", data) if isinstance(data, dict) else data
    total = len(rows)
    unmet = [r for r in rows if is_unmet(r, a.conf_threshold)]

    # 주제 집계(정규화 키워드 빈도)
    kw = Counter()
    for r in unmet:
        for t in set(norm(r.get("question", "")).split()):
            kw[t] += 1
    # 미충족 질문 원문 빈도
    qcount = Counter(r.get("question", "").strip() for r in unmet)

    report = {
        "total_logs": total,
        "unmet_count": len(unmet),
        "unmet_rate": round(len(unmet) / total, 3) if total else 0,
        "conf_threshold": a.conf_threshold,
        "top_gap_keywords": kw.most_common(a.top),
        "top_unmet_questions": qcount.most_common(a.top),
        "hint": "top_gap_keywords/questions = 지식 스키마 보강 후보. 검토 후 knowledge_submissions(approved)로 반영.",
    }
    os.makedirs(a.out_dir, exist_ok=True)
    json.dump(report, open(os.path.join(a.out_dir, "gap_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    md = [f"# 지식 커버리지 갭 리포트", "",
          f"- 전체 로그: **{total}**  ·  미충족: **{len(unmet)}** ({report['unmet_rate']*100:.1f}%)  ·  신뢰도 임계값 {a.conf_threshold}", "",
          "## 자주 나온 미충족 주제(키워드)"]
    for k, c in report["top_gap_keywords"]:
        md.append(f"- {k} — {c}회")
    md += ["", "## 미충족 질문 원문 TOP"]
    for q, c in report["top_unmet_questions"]:
        md.append(f"- ({c}) {q}")
    md += ["", "> 위 후보를 검토해 지식 스키마에 추가하면 다음 재평가에서 recall 개선이 기대됩니다."]
    open(os.path.join(a.out_dir, "gap_report.md"), "w", encoding="utf-8").write("\n".join(md))
    print(f"[analyze] total={total} unmet={len(unmet)} → {a.out_dir}/gap_report.(json|md)")

if __name__ == "__main__":
    main()
