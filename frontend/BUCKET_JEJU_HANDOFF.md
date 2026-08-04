# 버킷 제주 M3 인수인계

## 웹 데모

- 라이브 주소: https://bucket-jeju-join.ep01-sleepwar.chatgpt.site/
- 공식 프론트엔드: React 19 + TypeScript + Vinext
- 원본 작업 저장소: https://github.com/jsk900210-oss/jeju-bucket-map/tree/gpt/codex-vinext
- GitHub 변경과 웹 배포는 자동 연동되지 않으므로 별도 배포가 필요합니다.

## 프로젝트 목표

버킷 제주 게스트하우스 방문객이 주변 장소를 찾고, 투숙객끼리 Join을 만들며, 게스트하우스 이용 안내를 질문할 수 있는 서비스를 구축합니다.

## 현재 프론트엔드

- 홈, 근처 발견, Join, AI 질문, 프로필 화면
- 모바일 하단 내비게이션
- Join 작성 모달과 카테고리 필터
- 최신 Join 메인 노출
- 닉네임 편집 화면
- 버킷 제주 중심 주변 장소 지도 및 장소 카드

주요 파일:

- `frontend/app/client-home.tsx`
- `frontend/app/globals.css`
- `frontend/app/page.tsx`
- `frontend/app/layout.tsx`

## 웹데모 전용 서버 기능

- Sites 인증 헤더 기반 사용자 식별
- Cloudflare D1 + Drizzle ORM
- Join 조회·작성 API
- 닉네임 변경 API
- 모집시간이 지난 Join의 상태 자동 종료

주요 파일:

- `frontend/app/api/joins/route.ts`
- `frontend/app/api/profile/route.ts`
- `frontend/app/chatgpt-auth.ts`
- `frontend/db/schema.ts`
- `frontend/db/index.ts`
- `frontend/drizzle/`

`backend/`의 FastAPI 코드는 팀의 RAG·검색 API 영역으로 유지합니다. Sites 전용 API와 D1 코드는 배포 구조상 `frontend/` 아래에 둡니다.

## 팀 RAG 백엔드

팀 `M3`의 다음 내용을 우선 보존합니다.

- `backend/build_index.py`
- `backend/services/rag_service.py`
- `backend/utils/geo.py`
- `data/index/`, `data/processed/`, `data/scripts/`
- `docs/api_contract.md`, `docs/kb_schema.md`

## RAG 자료 요청

- 체크인·체크아웃 안내
- 1층·2층 공간 목록과 사진
- 공간별 이용 가능 시간
- 주방·세탁실·샤워실·공용공간 이용규칙
- 정숙 시간과 금지사항
- 안전시설·비상구 안내
- 주변 맛집·카페·관광지 추천
- 자주 묻는 질문과 답변
- 자료별 출처와 최신 작성일

## 현재 제한과 남은 작업

1. 팀 리뷰 후 M3 PR 병합
2. 최신 소스를 기존 운영 사이트에 재배포
3. Join 참여·취소 API와 DB 저장 구현
4. RAG 문서 분할·임베딩·검색·출처 표시 구현
5. 1층·2층 게스트하우스 이용 안내 화면 구현
6. 방문객 장소 리뷰 기능 구현
7. Kakao 지도 API 연결 및 주변 장소 자동 로드

## 협업 및 배포 규칙

- 팀 대상 브랜치: `gon311/DLthon_2nd:M3`
- 포크 작업 브랜치: `jsk900210-oss/DLthon_2nd:m3`
- 프론트 작업 대상: `frontend/`
- RAG 백엔드 작업 대상: `backend/`, `data/`, `docs/`
- API 키와 비밀번호는 저장소에 커밋하지 않습니다.
- 기존 `.openai/hosting.json`의 `project_id`와 운영 주소를 재사용하며 새 사이트를 만들지 않습니다.
