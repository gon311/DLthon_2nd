# 버킷제주 디버깅 및 통합 이력

현재 버전: **v1.5.0**  
버전 기준일: 2026-08-04

## 버전 이력

### v1.5.0 — 저장소 표준 경로 통합 및 최신 디버깅 기록

- 1차 저장소를 팀 기준 `frontend/`, `backend/`, `data/`, `docs/` 구조로 변경
- 기존 `codex-vinext/` 파일 44개 이동 및 누락 0개 확인
- 중복 DB·Drizzle·Supabase·Worker 등 13개 파일 삭제
- 기존 Sites `project_id` 보존 확인
- 최신 기능·동기화·배포·남은 작업을 디버깅 문서로 통합

### v1.4.0 — 팀 M3 및 포크 m3 동기화

- 팀 `gon311/DLthon_2nd:M3` 내용을 포크 `jsk900210-oss/DLthon_2nd:m3`에 반영
- 뒤처진 팀 커밋 23개 반영
- `frontend/BUCKET_JEJU_HANDOFF.md` 충돌 해결
- 동기화 후 팀 변경 누락 0개 확인
- 팀 M3 대상 Draft PR #7 생성

### v1.3.0 — RAG 백엔드 및 POI 자료 통합

- POI 수집·변환·설명 생성 스크립트 반영
- 숙소 기준 거리 계산 공용 모듈 반영
- ChromaDB 인덱스 생성 및 RAG 검색 서비스 반영
- API 계약서와 지식베이스 스키마 반영
- 생성 가능한 ChromaDB 바이너리는 1차 저장소에서 제외

### v1.2.0 — Join 마감 상태 디버깅

- 모집인원과 관계없이 마감시간 경과 시 모집완료 처리
- 오늘 20시 마감 Join은 20시 이후 모집완료가 되는 기준 확정
- Join 목록과 메인 화면 상태 표시 기준 통일

### v1.1.0 — Join 작성·조회 및 프로필 개선

- Join 작성 모달과 카테고리 필터 구현
- 작성한 Join을 메인 최신 Join 영역에 연결
- 닉네임 조회·변경 화면과 API 구현
- D1·Drizzle 기반 사용자와 Join 저장 구조 추가

### v1.0.0 — 초기 웹데모

- React 19 + TypeScript + Vinext 기본 웹데모 구성
- 홈, 근처 발견, Join, AI 질문, 프로필 탭 구성
- 버킷제주 주변 장소 카드와 모바일 내비게이션 구성
- 기존 Sites 프로젝트와 운영 주소 연결

## 저장소 연결 관계

1. 1차: `jsk900210-oss/jeju-bucket-map:gpt`
2. 2차 포크: `jsk900210-oss/DLthon_2nd:m3`
3. 3차 팀: `gon311/DLthon_2nd:M3`

공통 표준 경로:

- `frontend/`: React/Vinext 웹데모, Sites API, D1·Drizzle
- `backend/`: FastAPI 및 RAG 검색 백엔드
- `data/`: POI CSV와 수집·가공 스크립트
- `docs/`: API 계약, 지식베이스, 인수인계와 디버깅 문서

## 해결된 문제

- Join 작성 후 메인 최신 Join에 나타나지 않던 데이터 흐름 통합
- 모집시간 경과 후에도 모집중으로 보이던 상태 계산 수정
- 팀 M3 변경 23개 누락 해결 및 문서 충돌 1개 통합
- 저장소별로 달랐던 프론트엔드·백엔드·데이터·문서 경로 표준화

## 배포 설정

- 운영 주소: https://bucket-jeju-join.ep01-sleepwar.chatgpt.site/
- 배포 기준 폴더: `frontend/`
- 설정: `frontend/.openai/hosting.json`
- 기존 `project_id`: `appgprj_6a6af8aa68188191b0b6e49911cbf2b1`
- 새 사이트를 만들지 않고 기존 프로젝트와 주소를 재사용한다.

## 남은 작업

- Join 참여·취소 API 및 DB 저장
- AI 질문 탭과 RAG API 실제 연결
- 답변 출처와 장소 근거 표시
- 1층·2층 공간 안내 및 이용규칙 화면
- 방문객 장소 리뷰 탭
- Kakao 지도 API 운영 키 연결
- 최신 소스를 기존 Sites 프로젝트에 재배포
- 팀 리뷰 후 PR #7을 `gon311:M3`에 병합
