# 웹데모 RAG 연결 — 실행 순서 (RUNBOOK)

> ⚠️ **정직한 구분**: 이 Worker RAG는 팀의 `rag_service.py`를 호출하지 않는 **별도의 경량 재구현**입니다.
> 지식 소스(POI CSV + FAQ JSON)와 규칙(고정 응답·폴백·거리 재랭킹)만 동일하게 맞췄고, 코드는 독립적입니다.
> - **라이브 데모**: 배포 안정성을 위해 이 경량 Worker 구현 사용(동일 지식·동일 규칙).
> - **RAGAS 평가 점수**: 오프라인 파이썬 RAG 파이프라인(`rag_service.py`) 기준. 두 구현의 점수를 동일시하지 말 것.

담당: **[M3]** 프론트 · **[PL/M2]** 키·백엔드 · **[Codex]** 배포

### 1. [M3] 파일 적용 (프론트 저장소)
- `frontend/app/api/ask/route.ts`  (추가)
- `frontend/app/AskTab.tsx`  (추가)
- `frontend/scripts/build_knowledge_embeddings.mjs`  (추가)
- `frontend/app/client-home.tsx`  (수정 2줄):
  1. 상단 import에 `import AskTab from "./AskTab";`
  2. 기존 `{tab === "ask" && <section className="subpage shell ask-page"> … </section>}` 블록 전체를
     → `{tab === "ask" && <AskTab />}` 로 교체
- (선택) 질의 로그를 남기려면 `이용자 참여형 지식 파이프라인` 패키지의 `query_logs` 테이블·`/api/query-logs`도 함께 적용.

### 2. [PL/M2] 임베딩 생성 (OpenAI 키 필요, 1회)
```bash
OPENAI_API_KEY=sk-... node frontend/scripts/build_knowledge_embeddings.mjs
# → frontend/app/api/ask/knowledge_embeddings.json 생성 후 커밋
```

### 3. [Codex] 시크릿 설정
- Sites 환경변수에 `OPENAI_API_KEY` 추가 (없으면 /api/ask가 500).

### 4. [Codex] Sites 재배포
- 기존 방식대로 재배포(기존 프로젝트·주소 재사용).

### 5. [전원] 데모 검증 (필수)
- "가장 가까운 편의점은 어디야?" → 정상 답변 + 출처 표시
- "와이파이 비밀번호 알려줘" → FAQ 정상 답변
- "가장 가까운 약국이 어디야?" → **고정 응답(거부)** — 환각 방지 확인

### 6. [백업] 라이브 실패 대비
- 발표 백업으로 **'RAG 실제 응답' 슬라이드(13번)**는 그대로 유지.

> 순서 주의: **2번(임베딩) + 3번(키) 완료 전에는 배포하지 말 것.** 없으면 AI 탭이 500을 냅니다(나머지 앱은 정상).
