# [Codex 배포 요청] 웹데모 AI 질문 탭 ↔ RAG 연결

> ⚠️ **정직한 구분**: 이 Worker RAG는 팀의 `rag_service.py`를 호출하지 않는 **별도의 경량 재구현**입니다.
> 지식 소스(POI CSV + FAQ JSON)와 규칙(고정 응답·폴백·거리 재랭킹)만 동일하게 맞췄고, 코드는 독립적입니다.
> - **라이브 데모**: 배포 안정성을 위해 이 경량 Worker 구현 사용(동일 지식·동일 규칙).
> - **RAGAS 평가 점수**: 오프라인 파이썬 RAG 파이프라인(`rag_service.py`) 기준. 두 구현의 점수를 동일시하지 말 것.

**전제**: 아래 파일이 프론트에 적용되고, `knowledge_embeddings.json`이 생성돼 커밋된 상태.

1. **환경변수(시크릿) 추가**
   - `OPENAI_API_KEY` = (팀 OpenAI 키)
   - (선택) `SELF_BASE_URL` = 운영 도메인 (질의 로그 연동 시)
2. **배포**: 기존 방식대로 Sites 재배포 (chatgpt.site, 기존 프로젝트·주소 재사용, 새 사이트 생성 X)
3. **배포 후 확인**: `/api/ask`에 아래 두 질문이 정상/거부로 응답하는지
   - "가장 가까운 편의점은 어디야?" → 정상 답변
   - "가장 가까운 약국이 어디야?" → 고정 응답(데이터 없음 안내)

변경 파일: `frontend/app/api/ask/route.ts`, `frontend/app/AskTab.tsx`, `frontend/app/client-home.tsx`(2줄), `frontend/app/api/ask/knowledge_embeddings.json`
