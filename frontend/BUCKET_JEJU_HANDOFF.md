# 버킷 제주 웹 데모 — M3 인수인계

## 작업 위치와 실행 구조

- 작업 저장소: https://github.com/jsk900210-oss/DLthon_2nd/tree/m3
- 프론트엔드: `frontend/app.py` (Streamlit)
- Join API: `backend/main.py` (FastAPI)
- 합성 시드: `frontend/seed-data/`
- 기존 라이브 데모: https://bucket-jeju-join.ep01-sleepwar.chatgpt.site/

> 위 라이브 주소는 별도의 React/Vinext 데모입니다. `m3` 브랜치에 push해도 자동 배포되지 않으며, 현재 `m3`의 Streamlit·FastAPI 변경은 별도 실행 또는 배포가 필요합니다.

## M3에서 연결된 기능

- 버킷 제주 중심 반경 2km Kakao 지도 UI
- Join 목록 API 연결
- API 연결 실패 시 합성 시드 데이터 자동 대체
- 가상 투숙객 30명 및 Join 60건 로드
- 일정·상태·키워드 필터
- 닉네임만 노출하고 이름·이메일·전화번호는 사용하지 않음
- 합성 데이터 여부를 API 응답과 문서에서 명시

## API

기본 주소: `http://localhost:8000/api/v1`

- `GET /health`
- `GET /api/v1/joins`
- `GET /api/v1/joins/{join_id}`
- `GET /api/v1/guests`

`GET /api/v1/joins` 쿼리: `scheduledDate`, `status`, `keyword`, `page`, `pageSize`

## 환경 변수

`KAKAO_JS_KEY=카카오_자바스크립트_키`
`API_BASE_URL=http://localhost:8000/api/v1`

API 키나 비밀번호는 저장소에 커밋하지 않습니다. Kakao Developers에서 사용할 웹 도메인도 등록해야 합니다.

## 로컬 실행

저장소 루트에서 `pip install -r requirements.txt` 후 `uvicorn backend.main:app --reload`를 실행합니다.
별도 터미널에서 `pip install -r frontend/requirements.txt` 후 `streamlit run frontend/app.py`를 실행합니다.

## 점검 결과

- Python 문법 검사 통과
- 시드 데이터 로딩 확인: 투숙객 30명, Join 60건
- API가 꺼져 있을 때 프론트엔드의 시드 대체 로딩 확인
- `main`과 `m3`의 기존 인수인계 파일은 동일한 내용과 동일한 blob SHA였으므로 기존 파일 내용 충돌 없음
- `m3`는 `main`과 커밋 이력이 갈라져 있으므로 병합 전 PR의 최종 충돌 검사를 다시 수행할 것

## 아직 남은 항목

- 실제 배포 환경에 FastAPI와 Streamlit 배포
- `API_BASE_URL`, `KAKAO_JS_KEY`, Kakao 허용 도메인 설정
- 서버 기반 Kakao 장소검색 프록시(`/places/nearby`) 구현
- Join 생성·참여·수정·삭제 API 및 데이터베이스 영속화
- 체크아웃 이후 쓰기 차단을 위한 서버 인증과 숙박 유효기간 검증

## 협업 규칙

- M3 작업 브랜치: `m3`
- 주요 대상: `frontend/`, `backend/`
- 완료 시 변경 목적, 수정 파일, 테스트 결과, 미완료 사항을 문서에 누적 기록
- 다른 작업자의 변경을 덮어쓰지 말고 PR에서 변경 파일을 먼저 비교
