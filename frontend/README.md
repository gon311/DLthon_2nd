# BUCKET JEJU\n\n> 현재 통합 버전: **v1.6.0** · 2026-08-08\n\n\n버킷제주 게스트하우스 방문객을 위한 장소 발견 및 Join 커뮤니티 웹앱입니다.\n\n- 운영 주소: https://bucket-jeju-join.ep01-sleepwar.chatgpt.site\n- 사용자 식별: ChatGPT 로그인 후 서비스 내부 사용자 ID와 닉네임 사용\n- 데이터 저장: Cloudflare D1 + Drizzle ORM\n- 장소 범위: 버킷제주 기준 반경 2km\n\n## 파일 구성\n\n### 프론트엔드\n\n- `app/client-home.tsx`: 홈, 장소, Join, AI 질문, 프로필 탭과 Join 작성 화면\n- `app/globals.css`: 반응형 레이아웃과 Join 작성 모달 스타일\n- `app/page.tsx`: 로그인 사용자 및 저장된 닉네임을 화면에 전달\n- `app/layout.tsx`: 앱 공통 레이아웃\n\n### 백엔드\n\n- `app/api/joins/route.ts`: Join 목록 조회, 작성, 모집시간 종료 처리\n- `app/api/profile/route.ts`: 닉네임 변경\n- `app/chatgpt-auth.ts`: ChatGPT 인증 헤더 처리\n- `db/schema.ts`: 사용자, Join, 참여자 테이블\n- `db/index.ts`: Cloudflare D1 연결\n- `drizzle/0000_cheerful_spacker_dave.sql`: 기본 테이블 생성\n- `drizzle/0001_empty_secret_warriors.sql`: Join 키워드 필드 추가\n\n## 구현 기능\n\n- 닉네임을 2~20자로 변경하고 D1에 저장\n- 로그인 사용자가 Join 글 작성\n- 작성된 Join을 Join 탭과 메인 화면 최신 목록에 즉시 반영\n- 검색 키워드별 Join 필터링\n- 모집시간이 지나면 `모집중`을 `모집완료`로 자동 변경\n- 다겸님·현겸님 자료 반영 전 단계의 AI 질문 탭 제공\n\n## 디버깅 기록\n\n### 닉네임이 다시 원래 이름으로 바뀌는 문제\n\n- 원인: 페이지를 열 때 인증 헤더의 이름으로 `displayName`을 매번 덮어씀\n- 수정: 기존 DB 닉네임을 우선 사용하고 `PATCH /api/profile`로만 변경\n- 검증: 2~20자 유효성 검사와 변경 후 화면 갱신 확인\n\n### Join 글을 작성할 수 없는 문제\n\n- 원인: 화면에 정적 빈 배열만 있고 저장 API와 작성 폼이 없었음\n- 수정: D1 기반 `GET/POST /api/joins`, 로그인 검사, 작성 모달 추가\n- 검증: 제목·설명·장소·날짜·시간·키워드·인원 검증 및 저장 확인\n\n### 작성한 Join이 목록에 바로 보이지 않는 문제\n\n- 원인: 필터 결과 `useMemo`가 `keyword`만 의존해 `joins` 변경을 감지하지 못함\n- 수정: 의존성을 `[joins, keyword]`로 변경\n- 검증: 작성 성공 직후 Join 탭에 새 카드 표시\n\n### Join 글이 메인 화면에 보이지 않는 문제\n\n- 원인: 홈 미리보기가 DB Join 목록과 연결되지 않았음\n- 수정: 최신 Join 3건을 홈 미리보기에 연결\n- 검증: 새 Join 작성 후 홈 이동 시 최신 카드 표시\n\n### 모집시간이 지나도 모집중으로 남는 문제\n\n- 원인: 저장된 `status`만 읽고 현재 시각과 `scheduledAt`을 비교하지 않음\n- 수정: 목록 조회 시 만료된 `모집중` 행을 `모집완료`로 갱신하고 응답에서도 방어적으로 계산\n- 검증: `scheduledAt <= 현재시각` 조건의 상태 변환 코드 및 빌드 통과\n\n## 데이터베이스 적용\n\n배포 환경의 D1에 아래 마이그레이션이 순서대로 적용되어야 합니다.\n\n1. `drizzle/0000_cheerful_spacker_dave.sql`\n2. `drizzle/0001_empty_secret_warriors.sql`\n\n`.openai/hosting.json`의 D1 바인딩 이름은 `DB`를 사용합니다.\n\n## 검증\n\n- `vinext build` 성공\n- 최신 구현 커밋: `9602f9a152cab2c39bd1b308b2e6b26dcde8df1f`\n- 모집시간 자동 종료 구현을 포함한 소스 보관 파일:\n  `outputs/bucket-jeju-auto-close-v15.tar.gz`\n\n## 미완료 및 다음 단계\n\n- Join 참여·취소는 아직 브라우저 상태만 변경하며 DB에 저장되지 않음\n- AI 질문 탭은 자리만 마련했으며 RAG 데이터 연결 전\n- 다겸님·현겸님 자료를 받은 뒤 문서 분할, 임베딩, 검색, 답변 출처 표시 추가 예정\n- 방문객 리뷰 탭은 요청에 따라 추후 추가\n- 운영 URL은 최신 모집시간 자동 종료 커밋 재배포 필요\n\n\n\n## 팀 M3 자료 동기화\n\n- 동기화 원본: `jsk900210-oss/DLthon_2nd:m3` (팀 `gon311/DLthon_2nd:M3` 포함)\n- 동기화 일자: 2026-08-04\n- RAG 백엔드: `backend/`\n- POI 데이터와 수집·가공 스크립트: `data/`\n- API 계약 및 지식베이스 문서: `docs/`\n- Python 의존성: `backend/requirements.txt`\n\n### 반영된 자료\n\n- POI 임베딩 인덱스 생성 스크립트\n- ChromaDB 기반 RAG 검색·응답 서비스\n- 숙소 기준 거리 계산 공용 모듈\n- 게스트하우스 주변 POI CSV\n- POI 수집·변환·설명 생성 스크립트\n- API 계약서와 지식베이스 스키마\n- 프론트엔드·백엔드 통합 인수인계 문서\n\n### 디버깅 및 검증 상태\n\n- 팀 `M3`와 포크 `m3`의 문서 충돌을 해결하고 팀 변경 누락이 0개임을 확인했습니다.\n- 웹데모의 Join 작성·조회, 메인 최신 Join 표시, 닉네임 변경 기능을 분리해 유지했습니다.\n- 모집 시간이 지나면 인원 충족 여부와 관계없이 모집완료로 표시하도록 정리했습니다.\n- 웹데모 전용 API/D1 코드는 기존 위치에 유지하고, 팀 RAG 코드는 `backend/`로 분리했습니다.\n- 생성된 ChromaDB 바이너리는 재생성 가능한 산출물이므로 이번 1차 저장소 동기화에서 제외했습니다.\n- RAG 실행 전 `OPENAI_API_KEY`, `LODGING_LAT`, `LODGING_LNG` 환경변수 설정과 인덱스 재생성이 필요합니다.\n\n### 실행 전 확인사항\n\n1. `backend/requirements.txt`의 Python 패키지를 설치합니다.\n2. `data/processed/guesthouse_pois.csv`의 내용을 확인합니다.\n3. 환경변수를 설정한 뒤 `backend/build_index.py`로 인덱스를 생성합니다.\n4. RAG 스모크 테스트와 웹데모 API 연결 테스트를 진행합니다.\n

## v1.6.0 변경 기록 (2026-08-08 · Claude)

### 추가 기능
- 근처 발견 지도: 버킷제주 중심 반경 2km 원형 가이드(점선 울타리) 표시
- 근처 발견: 카테고리별(약국·병원·식당·아이스크림·카페·헬스장·편의점·해변·관광·항구) 이모지 마커를 지도에 표기, 카테고리 칩으로 지도·목록 동시 필터
- Join: 예정/지난 일정 분리(지난 일정은 접이식 "지난 일정 N개 보기") + 최신순·오래된순 정렬

### 구현·디버깅
- 지도 렌더링을 OpenStreetMap iframe → Leaflet(CDN, 루트 index.html과 동일 방식)으로 교체
  - 문제: 벡터 레이어/컨트롤 투영 시 `layerPointToLatLng` 오류
  - 수정: 맵 생성 직후 `setView`로 초기 뷰를 잡은 뒤 레이어·컨트롤 추가
  - 검증: 헤드리스 렌더로 2km 원과 마커 위치(축척바 기준 2km) 확인
- 마커 좌표는 프로토타입 근사값(방위·거리 기반, 반경 2km 내 분산 배치)
- Join 정렬/분리를 위해 표시용 시간 문자열 대신 실제 일정 시각(scheduledAt)으로 계산
  - 검증: 최신순 예정/오래된순, 지난 일정 분리 로직 단위검증 통과
- 충돌 방지: gpt 최신 기준으로 `app/client-home.tsx`, `app/globals.css`만 수정(백엔드/데이터 미변경)

### 검증
- `client-home.tsx` TSX 문법 통과(esbuild), 지도·카테고리 필터 헤드리스 렌더 확인

### 미완료 / 다음 단계
- 실제 장소 좌표·POI API 연동, 지난 일정의 자동 상태(일정완료) 처리 정교화
