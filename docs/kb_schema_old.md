# 지식베이스 스키마 정의

## 개요
- **목적**: POI(관심지점) 데이터를 임베딩 가능한 자연어 문서로 변환 → OpenAI Embeddings 벡터화 → ChromaDB에 저장
- **입력**: `data/processed/` 의 정제된 POI CSV (M1이 7/31 오후 EDA 완료 예전)
- **처리**: `backend/build_index.py` 스크립트 (PL이 7/31 오전 실행)
- **출력**: `data/embeddings/chroma/` ChromaDB persistent 인덱스

## 전제

### 숙소 고정
- 대상 숙소: **1곳만 고정** (좌표: `LODGING_LAT`, `LODGING_LNG`)
- 숙소 좌표는 `backend/utils/geo.py`에서 **단일 정의**하고, PL·M2가 동일 값을 import하여 사용
- POI 1건 = 문서 1개 (숙소별 조합 불필요)

### 거리 계산 (하버사인)
- **`distance_m`은 원본 데이터에 없는 파생값**
- POI 좌표(`lat`, `lng`) + 숙소 좌표 → `backend/utils/geo.py::haversine_m()` 호출 → 숙소 기준 거리 산출
- **M2의 매칭 모듈도 동일한 `utils/geo.py` 함수를 import해야 함** (거리값 일치 보장)
- 인덱싱 시점에 1회 계산하여 메타데이터에 고정 저장 (런타임 재계산 없음)

### 저장소
- 벡터 DB: **ChromaDB persistent** (`data/embeddings/chroma/`)
  - 메타데이터 필터링 내장 → 오후 RAG 재순위화 단계에서 `distance_m`, `category_norm` 필터 재사용
  - 반복 실행 시에도 기존 인덱스 재사용, 재임베딩 방지

## CSV 스키마 (입력 데이터)

### 원본 필드 (M1이 제공)

| 필드명 | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| `poi_id` | string | 상권정보/카카오 원본 ID 유지 | `P001` |
| `name` | string | 상호명 | `행복분식` |
| `category_raw` | string | 원본 업종명 (통일 전) | `한식음식점` |
| `category_norm` | string | 통합 카테고리 (M1 기준 적용) | `음식점` |
| `lat` | float | POI 위도 | `35.1010` |
| `lng` | float | POI 경도 | `129.0350` |
| `nearest_stop_name` | string \| null | 최근접 버스정류장명 | `중앙동정류장` |
| `stop_lat` | float \| null | 정류장 위도 | `35.1012` |
| `stop_lng` | float \| null | 정류장 경도 | `129.0352` |
| `source` | string | 데이터 출처 | `상권정보` / `카카오로컬` / `관광파일` |
| `description` | string | POI 특징/설명 | `1인 좌석 보유, 24시간 영업` |

### 파생 필드 (build_index.py가 계산)

| 필드명 | 타입 | 계산 방법 | 설명 |
| --- | --- | --- | --- |
| `distance_m` | int | `haversine_m(LODGING_LAT, LODGING_LNG, lat, lng)` | 숙소 기준 거리(m) |
| `stop_distance_m` | int \| null | `haversine_m(lat, lng, stop_lat, stop_lng)` (단, 좌표 없으면 null) | POI-정류장 간 거리(m) |

> **중요**: `haversine_m` 함수는 `backend/utils/geo.py`에서 import해야 함. 각자 구현하지 말 것.

## 문서 본문 템플릿 (임베딩 대상 텍스트)

### 형식

```
{name}은(는) {category_norm}으로, 숙소에서 약 {distance_m}m 거리에 있다.
특징: {description}.
{transit_note (선택)}
```

### 규칙
- `transit_note`: 최근접 정류장이 있고 `stop_distance_m ≤ 300m`일 때만 포함
  - 포함 형식: `"인근 정류장: {nearest_stop_name}, 도보 약 {stop_distance_m}m."`
  - 300m 초과 또는 정류장 없으면 생략 (불필요한 정보로 임베딩 품질 저하 방지)

### 예시

**포함되는 문서**
```
행복분식은(는) 음식점으로, 숙소에서 약 180m 거리에 있다.
특징: 1인 좌석 보유, 24시간 영업.
인근 정류장: 중앙동정류장, 도보 약 90m.
```

**정류장 300m 초과 (transit_note 생략)**
```
보수동책방골목은(는) 관광/문화으로, 숙소에서 약 650m 거리에 있다.
특징: 헌책방 거리, 도보 관광 코스.
```

## 메타데이터 (ChromaDB 저장)

문서 본문과 분리하여 저장. 검색 필터링 및 오후 RAG 재순위화에서 사용.

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| `name` | string | 상호명 |
| `category_norm` | string | 통합 카테고리 |
| `distance_m` | int | 숙소 기준 거리 (m) |
| `source` | string | 데이터 출처 |

## 카테고리 통합 기준 (임시 초안, M1 EDA 결과로 확정 예정)

> 다음은 임시 초안이며, M1의 7/31 오후 EDA 완료 후 `category_raw` 분포를 보고 확정한다.

- **`음식점`**: 한식/카페/주점/분식 등 음식료
- **`관광/문화`**: 관광지/박물관/갤러리/유적지 등
- **`편의시설`**: 편의점/약국/은행/공중화장실 등
- **`교통`**: 버스정류장/지하철역 등 (필요시)

> EDA 완료 후 이 목록을 갱신하고, `distance_m` 컷오프(예: 500m, 1km 중 선택)도 함께 확정한다.

## build_index.py 실행 흐름

```
1. data/processed/sample_poi.csv (또는 실데이터) 로드
2. 각 행(POI)에 대해:
   - distance_m = distance_from_lodging_m(lat, lng)  ← utils/geo.py import
   - stop_distance_m = haversine_m(lat, lng, stop_lat, stop_lng) (if 정류장 좌표 존재)
   - 문서 본문 생성 (위 템플릿 적용)
3. 모든 문서 배치 OpenAI Embeddings API 호출
4. ChromaDB persistent에 저장:
   - ID: poi_id
   - embedding: 임베딩 벡터
   - document: 본문
   - metadata: {name, category_norm, distance_m, source}
```

### 사용법

```bash
cd DLthon_2nd

# 환경변수 설정
export OPENAI_API_KEY=sk-...
export LODGING_LAT=35.1012
export LODGING_LNG=129.0352

# 인덱싱 실행
python backend/build_index.py \
  --csv data/processed/sample_poi.csv \
  --collection poi_demo \
  --smoke-test
```

## 스모크 테스트 (build_index.py --smoke-test)

인덱싱 완료 후 다음 쿼리로 동작 확인:
- `"숙소 근처 혼밥 가능한 식당"` → `행복분식` / `돼지국밥집` 상위 노출
- `"도보 관광 코스 추천"` → `보수동책방골목` 상위 노출
- `"숙소에서 가장 가까운 편의점"` → `GS25 중앙점` 상위 노출

검색 결과에 거리와 카테고리가 메타데이터로 표시되면 성공.

## 체크리스트 (7/31 오전 종료 시)

- [ ] CSV 입력 데이터 완성 (`data/processed/sample_poi.csv` 또는 실데이터)
- [ ] `backend/utils/geo.py` 작성 및 M2와 공유 확인
- [ ] `backend/build_index.py` 작성 및 로컬 테스트
- [ ] ChromaDB 인덱스 생성 (`data/embeddings/chroma/`)
- [ ] 스모크 테스트 통과
- [ ] 이 문서(`docs/kb_schema.md`) 최종 확인
- [ ] `data/embeddings/` 디렉토리 커밋 (재임베딩 방지)

## 관련 파일 목록

- 스크립트: `backend/build_index.py`
- 공용 모듈: `backend/utils/geo.py` (`__init__.py` 포함)
- 샘플 데이터: `data/processed/sample_poi.csv`
- 이 문서: `docs/kb_schema.md`
- 인덱스 저장: `data/embeddings/chroma/`