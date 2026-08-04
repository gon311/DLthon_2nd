# 지식베이스 스키마 (KB Schema)

**최초 작성**: 2026-07-30 (PL, 스켈레톤)
**최종 확정**: 2026-07-31 (PL, EDA·실데이터 반영)
**대상 데이터**: `data/processed/guesthouse_pois.csv` (21개 POI, 2026-07-31 확정)

## 개요

- **목적**: POI 데이터를 임베딩 가능한 자연어 문서로 변환 → OpenAI Embeddings 벡터화 → ChromaDB에 저장
- **입력**: `data/processed/guesthouse_pois.csv` (아래 파이프라인 3단계 산출물)
- **처리**: `backend/build_index.py` (PL 실행)
- **출력**: `data/index/chroma/` ChromaDB persistent 인덱스 (7/31 종료 시 커밋 대상)

## 데이터 파이프라인 (실행 순서 고정)

```
1. collect_pois.py           → guesthouse_pois.json   (Kakao 수집 + 정류장 매핑, description 빈값)
2. json_to_csv.py            → guesthouse_pois.csv    (필드명 변환 + category_norm 부여)
3. generate_description.py   → guesthouse_pois.csv    (description + solo_friendly 채움, 같은 파일 갱신)
4. build_index.py            → data/index/chroma/ (거리 계산 + 문서화 + 임베딩 + 인덱싱)
```

> **주의**: 3단계 이후 2단계(json_to_csv)를 재실행하면 solo_friendly 컬럼이 유실된다.
> 데이터를 재수집한 경우 반드시 1→2→3→4 전체를 순서대로 재실행할 것.

## 전제

### 숙소 고정
- 대상 숙소: **1곳 고정** (제주 대정읍 '버킷제주', 좌표: `LODGING_LAT`, `LODGING_LNG`)
- 숙소 좌표는 `backend/utils/geo.py`에서 **단일 정의**. PL·M1·M2 모두 동일 값을 import
- POI 1건 = 문서 1개

### 거리 계산 (하버사인)
- `distance_m`, `stop_distance_m`은 **CSV에 없는 파생값**으로, build_index.py가 인덱싱 시점에 1회 계산
- 계산 함수는 `backend/utils/geo.py::haversine_m()` / `distance_from_lodging_m()` — **각자 구현 금지**
- 계산 결과는 메타데이터에 고정 저장 (런타임 재계산 없음)

### 저장소
- 벡터 DB: **ChromaDB persistent** (`data/index/chroma/`)
- 반복 실행 시 upsert로 기존 인덱스 갱신 (컬렉션명: `poi_demo`)

## CSV 스키마 (build_index.py 입력)

### 원본 필드 (파이프라인 1~3단계 산출)

| 필드명 | 타입 | 생성 단계 | 설명 | 예시 |
| --- | --- | --- | --- | --- |
| `poi_id` | string | 1 (json_to_csv에서 rename) | Kakao 장소 ID | `1265980xxx` |
| `name` | string | 1 | 상호명 | `대정쌍둥이식당` |
| `category_raw` | string | 1→2 rename | api_contract 카테고리 | `restaurant` / `attraction` / `culture` / `convenience_store` / `parking` |
| `category_norm` | string | 2 | 통합 카테고리 (아래 기준) | `음식점` / `관광/문화` / `편의시설` |
| `lat` | float | 1→2 rename | POI 위도 | `33.2168` |
| `lng` | float | 1→2 rename | POI 경도 | `126.2506` |
| `nearest_stop_name` | string | 1 | 최근접 버스정류장명 (공공데이터 CSV 매핑) | `하모리` |
| `stop_lat` | float | 1 | 정류장 위도 | `33.2172` |
| `stop_lng` | float | 1 | 정류장 경도 | `126.2510` |
| `source` | string | 1 | 데이터 출처 | `kakao_local` |
| `description` | string | 3 | LLM 생성 한 문장 설명 (20~50자) | `현지인이 찾는 밀면·수육 맛집` |
| `solo_friendly` | string | 3 | 1인 이용 적합도 (`True`/`False`/빈값=중립) | `True` |

### 파생 필드 (build_index.py가 계산)

| 필드명 | 타입 | 계산 방법 | 설명 |
| --- | --- | --- | --- |
| `distance_m` | int | `distance_from_lodging_m(lat, lng)` | 숙소 기준 거리(m) |
| `stop_distance_m` | int \| null | `haversine_m(lat, lng, stop_lat, stop_lng)` | POI-정류장 거리(m). 좌표 없으면 null |

## 카테고리 통합 기준 (category_norm) — 7/31 확정

수집 반경은 collect_pois.py에서 카테고리별로 이원화되어 있다 (EDA 결과 반영).

| category_raw | category_norm | 수집 반경 | 7/31 개수 |
| --- | --- | --- | --- |
| `restaurant` (FD6) | `음식점` | 500m | 12 |
| `attraction` (AT4) | `관광/문화` | 1500m | 4 |
| `culture` (CT1) | `관광/문화` | 1500m | 3 |
| `convenience_store` (키워드) | `편의시설` | 500m | 2 |
| `parking` (키워드) | `편의시설` | 500m | 1 |
| 그 외 | `기타` | — | 0 |
| **합계** | | | **21** |

> ⚠️ **json_to_csv.py 수정 필요 (7/31 발견 버그)**: `normalize_category()`가
> `tourist_spot/museum/gallery`를 기대하나 실데이터는 `attraction/culture`이다.
> 수정 전에는 관광 POI 7개가 전부 `기타`로 분류되어 카테고리 필터가 동작하지 않는다.

## 문서 본문 템플릿 (임베딩 대상 텍스트)

build_index.py의 `build_document_text()` 구현 기준:

```
{name}은(는) {category_norm}으로, {description}. 숙소에서 약 {distance_m}m 거리에 있다.
{transit_note (조건부)}
```

### 규칙
- `transit_note`: `stop_distance_m ≤ 300m`일 때만 포함
  - 형식: `"인근 정류장: {nearest_stop_name}, 도보 약 {stop_distance_m}m."`
  - 300m 초과 또는 정류장 좌표 없으면 생략 (임베딩 품질 저하 방지)

### 예시

**정류장 포함**
```
대정쌍둥이식당은(는) 음식점으로, 현지인이 찾는 밀면·수육 맛집. 숙소에서 약 320m 거리에 있다. 인근 정류장: 하모리, 도보 약 90m.
```

**정류장 300m 초과 (생략)**
```
알뜨르비행장은(는) 관광/문화으로, 일제강점기 역사 유적지. 숙소에서 약 1240m 거리에 있다.
```

## 메타데이터 (ChromaDB 저장)

문서 본문과 분리 저장. 검색 필터링 및 재순위화에서 사용.

| 필드명 | 타입 | 설명 | 사용처 |
| --- | --- | --- | --- |
| `name` | string | 상호명 | 응답 표기 |
| `category_norm` | string | 통합 카테고리 | 의도별 카테고리 필터 |
| `distance_m` | int | 숙소 기준 거리 | **반경 필터** (500m/1500m 분기) |
| `source` | string | 데이터 출처 | 근거 표기 |
| `solo_friendly` | string | 1인 적합도 | **재순위화** (1인 여행객 가중) |

## RAG 검색 전략 (rag_service.py 구현 지침)

### 반경 이원화 — EDA 결과 반영 (7/31 확정)

| 질문 의도 | 반경 (distance_m 필터) | 대상 category_norm |
| --- | --- | --- |
| `food` (맛집·식사) | ≤ 500 | 음식점 |
| `convenience` (편의점·주차) | ≤ 500 | 편의시설 |
| `tourism` (관광·명소·문화) | ≤ 1500 | 관광/문화 |
| `other` (기본값) | ≤ 500 | 전체 |

- 반경은 **ChromaDB 메타데이터 필터(`distance_m`)로 적용** — LLM 프롬프트가 반경을 판단하지 않음
- 의도 분류는 rag_service.py에서 수행 (규칙 기반 키워드 매칭 우선, 불충분 시 LLM 분류)

### 재순위화 (유사도 상위 5개 대상)

1. **숙소 근접도**: distance_m 오름차순 가중
2. **1인 적합성**: solo_friendly가 `True`인 POI 가중, `False`는 감점
3. **세부 다양성**: 응답 생성 프롬프트에서 동일 업종 중복 추천 방지 규칙 적용

## build_index.py 실행

```bash
cd DLthon_2nd
export OPENAI_API_KEY=sk-...

python backend/build_index.py \
  --csv data/processed/guesthouse_pois.csv \
  --collection poi_demo \
  --smoke-test
```

> 인덱스 경로는 코드 기준 `data/index/chroma/`로 확정 (7/31 결정). 인수인계 문서(README, .gitignore, resume_checklist)가 `data/embeddings/`를 참조하고 있다면 `data/index/`로 정정할 것.

## 스모크 테스트 (--smoke-test)

| 쿼리 | 기대 결과 | 검증 포인트 |
| --- | --- | --- |
| `"숙소 근처 혼밥 가능한 식당"` | solo_friendly=True 음식점 상위 | 재순위화 동작 |
| `"관광지 추천해줘"` | 관광/문화 POI 상위 (≤1500m) | 카테고리 정규화 + 확장 반경 |
| `"숙소에서 가장 가까운 편의점"` | 편의시설 2건 중 근거리 우선 | distance_m 정렬 |
| `"은행 어디 있어?"` | 결과 없음 → 거절 응답 | 함정 질문 (할루시네이션 방지) |

**성공 기준**: 검색 결과에 거리·카테고리·(해당 시) 정류장이 표시되고, 반경·카테고리 필터가 분기 동작하며, 없는 데이터는 거절.

## 체크리스트 (7/31 오후 종료 시)

- [x] POI 데이터 확보 (21개 확정, 반경 500/1500 이원화)
- [x] 최근접 버스정류장 매핑 완료
- [ ] json_to_csv.py 카테고리 버그 수정 (attraction/culture → 관광/문화)
- [ ] generate_description.py 실행 (description + solo_friendly 21건)
- [ ] build_index.py 실행 (INDEX_DIR = data/index/chroma, 코드 그대로)
- [ ] 인수인계 문서의 인덱스 경로 표기를 data/index/로 정정
- [ ] 스모크 테스트 4종 통과
- [ ] `data/index/` 커밋 (재임베딩 방지)
- [ ] 이 문서 최종 확인 후 커밋

## 관련 파일

- 수집: `data/scripts/collect_pois.py`
- 변환: `data/scripts/json_to_csv.py`
- 설명 생성: `data/scripts/generate_description.py`
- 인덱싱: `backend/build_index.py`
- 공용 모듈: `backend/utils/geo.py`
- 인덱스: `data/index/chroma/`
- 이전 버전: `docs/kb_schema_old.md` (7/30 스켈레톤, 참조용)

## 변경 이력

| 일시 | 변경 | 담당 |
| --- | --- | --- |
| 2026-07-30 | 스켈레톤 작성 (필드 구조, 템플릿, 실행 흐름) | PL |
| 2026-07-31 | 실데이터 21건 확정, 파이프라인 4단계 고정, 반경 이원화(500/1500), solo_friendly 반영, json_to_csv 버그 기록, 인덱스 경로 data/index/chroma 확정 | PL |