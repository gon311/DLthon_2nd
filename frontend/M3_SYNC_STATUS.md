# 버킷 제주 웹 데모 — M3 인수인계

## 공식 작업 위치

- 원본: https://github.com/jsk900210-oss/jeju-bucket-map/tree/main/codex-vinext
- 최종 M3: https://github.com/jsk900210-oss/DLthon_2nd/tree/m3/frontend
- 합성 데이터: https://github.com/jsk900210-oss/DLthon_2nd/tree/m3/frontend/seed-data
- 기존 라이브: https://bucket-jeju-join.ep01-sleepwar.chatgpt.site/

## 공식 프론트엔드

2026-07-31부터 M3의 공식 프론트엔드는 React 19 + TypeScript + Vinext입니다.

- 앱 화면: `frontend/app/`
- 정적 자산: `frontend/public/`
- 데이터 계층: `frontend/db/`, `frontend/drizzle/`
- Worker: `frontend/worker/`
- 실행 설정: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/next.config.ts`
- 배포 설정: `frontend/.openai/hosting.json`

`app.py`, `api_client.py`, `requirements.txt`는 이전 Streamlit 검토본이며 공식 실행 대상이 아닙니다. 기존 기록 보존을 위해 삭제하지 않았습니다.

## v5 — jeju-bucket-map React 원본을 M3로 동기화

- `jeju-bucket-map/main/codex-vinext`의 앱 소스와 설정을 `DLthon_2nd/m3/frontend`로 복사
- 대표 이미지 `public/og.png` 포함
- 가상 투숙객 30명과 Join 60건이 React 화면에 표시되는 코드 확인
- 기존 `seed-data`, API 검토 문서, 인수인계 기록 보존
- 원본 README는 충돌 방지를 위해 `REACT_APP_README.md`로 저장

## 실행

`frontend` 폴더에서 다음을 실행합니다.

`pnpm install`
`pnpm run dev`

빌드는 `pnpm run build`입니다.

## 점검 결과

- React 소스·설정·정적 이미지의 M3 업로드 완료
- `app/page.tsx`에서 투숙객 30명, Join 60건 생성 확인
- Join 일정은 2026-08-01~2026-08-15 범위
- 기존 합성 데이터 폴더 유지 확인
- 로컬 빌드는 실행 환경의 npm registry 접근 제한(EACCES)으로 의존성 설치 단계에서 완료하지 못함

## API 상태

- 저장소 루트의 `backend/main.py` FastAPI 조회 API는 유지됩니다.
- 현재 React 화면의 Join 60건은 `app/page.tsx`에서 생성되며 FastAPI를 호출하지 않습니다.
- 실제 API 연결 시 React에서 `/api/v1/joins`를 호출하도록 별도 작업이 필요합니다.
- Kakao 지도는 JavaScript 키와 배포 도메인 등록이 필요합니다.

## 배포 주의

GitHub M3 업로드와 기존 chatgpt.site 배포는 자동 연동되지 않습니다. 실제 웹 반영에는 M3 프론트엔드 소스를 대상으로 별도 배포가 필요합니다.

## 협업 규칙

- M3 공식 프론트엔드 수정은 `frontend/app`, `frontend/public`, `frontend/db`, `frontend/worker` 범위에서 진행
- API 키와 비밀번호는 커밋하지 않음
- 버전별 변경과 테스트 결과를 문서에 누적 기록
- 병합 전 PR에서 충돌 검사를 다시 수행
