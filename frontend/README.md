# BUCKET JEJU

> 현재 버전: **v1.6.0** · 2026-08-10

버킷제주 게스트하우스 방문객을 위한 근처 장소 발견 및 Join 커뮤니티 웹앱입니다.

- 운영 주소: https://bucket-jeju-join.ep01-sleepwar.chatgpt.site
- 사용자 식별: ChatGPT 로그인 후 서비스 내부 사용자 ID·닉네임 사용
- 데이터 저장: Cloudflare D1 + Drizzle ORM
- 장소 범위: 버킷제주 기준 **반경 2km**

## 주요 기능

- **근처 발견 지도** — 반경 2km 원형 가이드(점선 울타리)와 장소 마커 (Leaflet)
- **실좌표 검수 마커** — kakao_local 실좌표(`data/processed/guesthouse_pois.csv`, 2km 내 21곳) 기준, 바다 위 오표기 제거
- **카테고리 필터** — 식당🍽️ · 편의점🏪 · 해변🏖️ · 관광📷 · 주차장🅿️ (지도·목록 동시 필터)
- **장소 상세 패널** — 마커/카드 클릭 시 안내 문구 표시
- **Join 커뮤니티** — 작성·조회, 메인 최신 Join 노출, 모집중 / 모집완료 / 일정완료 3상태 분리, 예정·지난 일정 구분
- **닉네임 변경** — 2~20자, D1 영구 저장
- **AI 질문 탭** — RAG 연결 준비 단계

## 파일 구성

### 프론트엔드

- `app/client-home.tsx` — 홈·근처 발견(지도)·Join·AI 질문·프로필 탭과 Join 작성 화면
- `app/globals.css` — 반응형 레이아웃, 지도·Join 모달 스타일
- `app/page.tsx` — 로그인 사용자·저장된 닉네임 전달
- `app/layout.tsx` — 앱 공통 레이아웃
- `seed-data/guesthouse-faq.ts` — 게스트하우스 FAQ·다국어 카피

### 백엔드 (웹데모 전용)

- `app/api/joins/route.ts` — Join 목록 조회·작성, 모집시간 종료 처리
- `app/api/joins/[id]/participants/route.ts` — Join 참여자 처리
- `app/api/profile/route.ts` — 닉네임 변경
- `app/chatgpt-auth.ts` — ChatGPT 인증 헤더 처리
- `db/schema.ts` — 사용자·Join·참여자 테이블
- `db/index.ts` — Cloudflare D1 연결
- `drizzle/` — D1 마이그레이션(`0000`, `0001`)

## 데이터베이스 적용

배포 환경 D1에 마이그레이션을 순서대로 적용합니다.

1. `drizzle/0000_cheerful_spacker_dave.sql`
2. `drizzle/0001_empty_secret_warriors.sql`

`.openai/hosting.json`의 D1 바인딩 이름은 `DB`를 사용합니다.

## 검증

- 운영 웹데모에서 2km 지도·마커 육안 검수 완료
- 좌표 출처: `data/processed/guesthouse_pois.csv` (kakao 실좌표)
- `client-home.tsx` 빌드/렌더 확인

## 미완료 · 다음 단계

- Join 참여·취소의 D1 영구 저장
- AI 질문 탭 RAG 데이터 연결(문서 분할·임베딩·검색·출처 표시)
- 하드코딩 POI(21곳)를 데이터 파이프라인/DB 기반으로 전환
- 방문객 리뷰 탭(방문 인증)

## 팀 M3 자료 동기화

- 동기화 원본: `jsk900210-oss/DLthon_2nd:m3` (팀 `gon311/DLthon_2nd:M3` 포함)
- RAG 백엔드 `backend/`, POI 데이터·스크립트 `data/`, API 계약·지식베이스 문서 `docs/`, Python 의존성 `backend/requirements.txt`
- RAG 실행 전 `OPENAI_API_KEY`, `LODGING_LAT`, `LODGING_LNG` 환경변수 설정과 인덱스 재생성이 필요합니다.
