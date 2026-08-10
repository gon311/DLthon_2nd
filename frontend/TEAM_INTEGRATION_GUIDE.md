# 팀 저장소 연동 가이드

## 충돌 방지 원칙

- 웹데모 코드는 팀 저장소의 `frontend/` 아래에서만 관리합니다.
- 팀의 RAG·FastAPI 구현인 루트 `backend/`는 웹데모 브랜치에서 수정하지 않습니다.
- 웹데모의 서버 기능은 Vinext 내부의 `app/api/`, `db/`, `drizzle/`에 둡니다.
- `.openai/hosting.json`의 기존 `project_id`와 D1 바인딩 `DB`를 유지합니다.

## 웹데모에 포함된 기능

- 닉네임 변경 및 D1 저장
- Join 글 작성과 목록 조회
- 새 Join의 메인 화면 및 Join 탭 즉시 반영
- 모집시간 경과 시 `모집완료` 자동 전환
- 향후 RAG 연결을 위한 AI 질문 탭

## 팀 저장소로 옮길 파일

- `app/`
- `db/`
- `drizzle/`
- `worker/`
- `public/`
- `.openai/hosting.json`
- `package.json`, 잠금 파일, 빌드 설정

팀 저장소에서는 위 파일을 `frontend/` 아래에 배치합니다. 루트 `backend/`,
`data/`, `docs/`는 팀의 최신 내용을 그대로 유지합니다.

## 병합 전 확인

1. PR 변경 파일에서 루트 `backend/` 변경을 제외합니다.
2. `frontend/app/api/`와 팀 RAG API의 주소가 겹치지 않는지 확인합니다.
3. D1 마이그레이션 두 개가 순서대로 포함됐는지 확인합니다.
4. 팀 `main` 최신 내용을 먼저 반영한 뒤 프론트 변경만 병합합니다.
5. 병합 후 웹데모 배포는 기존 Sites 프로젝트에 별도로 진행합니다.
