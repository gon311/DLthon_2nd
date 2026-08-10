# 이용자 참여형 지식 파이프라인 (User-Participatory Knowledge Pipeline)

버킷제주 RAG가 **쓸수록 똑똑해지도록** 하는 데이터 선순환 구조입니다.
현재는 우리가 넣은 정보로만 지식 스키마가 구성되지만, 이용자의 질문·제안이
자동으로 지식 스키마 보강으로 이어지게 만듭니다.

## 데이터 선순환

```
   [이용자 질문]                         [이용자 제안]
   AI 질문 탭                            "정보가 바뀌었어요"
       │ POST /api/query-logs                │ POST /api/knowledge
       ▼                                     ▼
   query_logs (D1)                       knowledge_submissions (D1, pending)
       │                                     │  관리자 검수(PATCH approved)
       │ GET(배치)                            ▼
       ▼                                 approved 제안
   analyze_query_logs.py  ──┐               │ ingest_submissions.py
   (미충족·저신뢰 질문 집계)  │               ▼
       │ gap_report          └──▶  지식 스키마 보강 문서(user_knowledge.jsonl)
       ▼                                     │ build_index (증분 재인덱싱)
   보강 우선순위 → 데이터 추가/제안 검토        ▼
                                         ChromaDB 재인덱싱 → RAG가 즉시 활용
                                             │
                                             ▼
                                     다음 RAGAS 재평가(자체 라벨링 기준)로 개선 확인
```

## 구성요소

| 레이어 | 파일 | 역할 |
|--------|------|------|
| DB | `frontend/db/schema.additions.ts`, `drizzle/0002_user_knowledge_pipeline.sql` | `query_logs`, `knowledge_submissions` 테이블 |
| API | `frontend/app/api/query-logs/route.ts` | 질의 로그 저장(POST)·피드백(PATCH)·조회(GET) |
| API | `frontend/app/api/knowledge/route.ts` | 이용자 제안 저장(POST)·검수 목록(GET)·검수 반영(PATCH) |
| 프론트 | `frontend/INTEGRATION.md` | AI 질문 탭 연동 코드 |
| 배치 | `backend/pipeline/analyze_query_logs.py` | 미충족 질문 → 지식 갭 리포트 |
| 배치 | `backend/pipeline/ingest_submissions.py` | approved 제안 → 지식 문서 → 재인덱싱 |

## 운영 순서(주기 배치)

1. `GET /api/query-logs` → `query_logs.json` 저장
2. `python backend/pipeline/analyze_query_logs.py --logs query_logs.json --out-dir data/eval`
3. `gap_report.md`에서 보강 후보 검토 → 데이터 추가 또는 이용자 제안 승인
4. `GET /api/knowledge?status=approved` → `approved.json`
5. `python backend/pipeline/ingest_submissions.py --submissions approved.json --reindex`
6. RAGAS 재평가로 개선 확인(자체 라벨링/골드셋 기준)

## 개인정보·안전

- **비식별화**: 질문·답변 저장 시 이메일/전화 마스킹, 길이 컷. 세션 id는 로그인과 분리.
- **동의·정책**: 개인정보처리방침에 "질의 데이터의 서비스 개선 목적 수집" 명시, 수집 동의·보관기간 설정.
- **검수 게이트**: 이용자 제안은 반드시 관리자 검수(approved) 후에만 지식 스키마 반영(오정보 차단).
- **폴백 유지**: 근거 없는 질문은 지어내지 않고 "정보 없음"으로 처리(환각 방지)하되, 그 로그를 갭 후보로 활용.

## 담당 제안

- **M3(프론트)**: `query_logs`/`knowledge` 테이블·API·AI 탭 연동
- **PL/M2(백엔드)**: `analyze`/`ingest` 배치, `build_index` 증분(`--jsonl --append`) 확장, 재평가
- **M1(데이터)**: gap_report 기반 신규 POI/FAQ 수집·정제
