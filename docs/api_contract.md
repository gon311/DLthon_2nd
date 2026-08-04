# API Contract (인터페이스 계약)

**확정일**: 2026년 7월 30일 (목)  
**동결**: 이 문서는 7월 31일 종료 시점에 동결되며, 이후 변경은 PL 승인 필수  
**담당**: PL (계약 설계 및 동결), M2 (백엔드 구현), M3 (프론트엔드 구현)

---

## 1. 데이터 모델 정의

### 1.1 Accommodation (숙소)
```json
{
  "accommodation_id": "acc_001",
  "name": "Seoul Guesthouse",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "address": "서울시 중구 명동",
  "created_at": "2026-01-15T10:00:00Z"
}
```

**테이블**: `accommodations`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT (PK) | 고유 ID |
| name | TEXT | 숙소명 |
| latitude | REAL | 위도 |
| longitude | REAL | 경도 |
| address | TEXT | 주소 |

---

### 1.2 POI (Point of Interest - 근거리 장소)
```json
{
  "poi_id": "poi_12345",
  "name": "명동 떡볶이",
  "category": "restaurant",
  "latitude": 37.5640,
  "longitude": 126.9820,
  "description": "인생 떡볶이로 유명한 명동 맛집. 주말 대기 시간 30분~1시간",
  "source": "kakao_local",
  "confidence_score": 0.92,
  "recommendation_reason": "숙소에서 550m 거리, 혼자 가기 좋은 식당"
}
```

**테이블**: `pois`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT (PK) | 고유 ID |
| name | TEXT | 장소명 |
| category | TEXT | 카테고리 (restaurant, attraction, cafe, etc.) |
| latitude | REAL | 위도 |
| longitude | REAL | 경도 |
| description | TEXT | RAG 생성 설명 (nullable 초기값) |
| source | TEXT | 데이터 출처 (kakao_local, file_data 등) |
| created_at | DATETIME | 생성 시각 |

---

### 1.3 JoinRequest (조인 요청)
```json
{
  "join_id": "join_001",
  "accommodation_id": "acc_001",
  "requester_id": "user_123",
  "requester_name": "김철수",
  "activity_type": "dining",
  "status": "pending",
  "created_at": "2026-07-30T14:00:00Z",
  "message": "명동에서 저녁 식사할 사람 구합니다!"
}
```

**테이블**: `join_requests`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | TEXT (PK) | 고유 ID |
| accommodation_id | TEXT (FK) | 숙소 ID |
| requester_id | TEXT | 요청자 ID |
| requester_name | TEXT | 요청자 이름 |
| activity_type | TEXT | 활동 유형 (dining, sightseeing, cafe, shopping 등) |
| status | TEXT | 요청 상태 (pending, accepted, declined) |
| message | TEXT | 요청 메시지 |
| created_at | DATETIME | 생성 시각 |

---

## 2. 엔드포인트 명세

### 2.1 근거리 정보 조회 (메인 기능)

**`POST /nearby-search`**

숙소 기준으로 반경 2km 내 근거리 정보를 RAG로 조회합니다.

#### 요청 (Request)
```json
{
  "accommodation_id": "acc_001",
  "keyword": "카페",
  "category_filter": ["cafe"],
  "user_profile": {
    "solo_traveler": true,
    "preferred_activities": ["sightseeing", "dining"]
  }
}
```

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `accommodation_id` | string | ✅ | 숙소 ID |
| `keyword` | string | ❌ | 검색 키워드 (예: "카페", "명동") |
| `category_filter` | array | ❌ | 카테고리 필터 배열 (restaurant, cafe, attraction, bus_stop 등) |
| `user_profile.solo_traveler` | boolean | ❌ | 혼자 여행 여부 (기본값: false) |
| `user_profile.preferred_activities` | array | ❌ | 선호 활동 배열 (dining, sightseeing 등) |

#### 응답 (Response 200 OK)
```json
{
  "status": "success",
  "accommodation": {
    "id": "acc_001",
    "name": "Seoul Guesthouse",
    "latitude": 37.5665,
    "longitude": 126.9780
  },
  "search_radius_m": 2000,
  "nearby_activities": [
    {
      "poi_id": "poi_12345",
      "name": "명동 떡볶이",
      "category": "restaurant",
      "distance_m": 550,
      "latitude": 37.5640,
      "longitude": 126.9820,
      "description": "인생 떡볶이로 유명한 명동 맛집. 주말 대기 시간 30분~1시간",
      "confidence_score": 0.92,
      "recommendation_reason": "숙소에서 가까운 거리에 위치하며, 혼자 방문하기 좋은 음식점입니다",
      "source": "kakao_local"
    },
    {
      "poi_id": "poi_12346",
      "name": "명동 성당",
      "category": "attraction",
      "distance_m": 820,
      "latitude": 37.5615,
      "longitude": 126.9850,
      "description": "서울의 대표 종교 문화유산. 아름다운 건축과 조용한 명상 공간",
      "confidence_score": 0.88,
      "recommendation_reason": "혼자 방문할 수 있는 관광지로, 문화 경험을 원하시는 분께 추천",
      "source": "file_data"
    }
  ],
  "result_count": 2,
  "response_time_ms": 1250,
  "hallucination_rate": 0.0
}
```

**응답 필드**:
| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | string | "success" 또는 "error" |
| `accommodation` | object | 조회된 숙소 정보 |
| `search_radius_m` | integer | 검색 반경 (고정: 2000m) |
| `nearby_activities` | array | 근거리 활동 목록 |
| `nearby_activities[].poi_id` | string | 장소 고유 ID |
| `nearby_activities[].distance_m` | integer | 숙소로부터의 거리 (미터) |
| `nearby_activities[].description` | string | RAG로 생성된 장소 설명 |
| `nearby_activities[].confidence_score` | float | 신뢰도 점수 (0.0~1.0) |
| `nearby_activities[].recommendation_reason` | string | 추천 이유 |
| `result_count` | integer | 반환된 결과 수 |
| `response_time_ms` | integer | API 응답 시간 (ms) |
| `hallucination_rate` | float | 할루시네이션 비율 (0.0~1.0) |

#### 응답 (Response 404 Not Found)
```json
{
  "status": "error",
  "error_code": "ACCOMMODATION_NOT_FOUND",
  "message": "Accommodation with ID 'acc_001' not found",
  "accommodation_id": "acc_001"
}
```

#### 응답 (Response 400 Bad Request)
```json
{
  "status": "error",
  "error_code": "INVALID_REQUEST",
  "message": "Required field 'accommodation_id' is missing",
  "details": {
    "missing_fields": ["accommodation_id"]
  }
}
```

---

### 2.2 숙소 조인 요청 목록 조회

**`GET /accommodations/{accommodation_id}/join-requests`**

특정 숙소의 조인 요청 목록을 조회합니다. 활동 유형과 상태로 필터링 가능합니다.

#### 요청 (Request)
```
GET /accommodations/acc_001/join-requests?activity_type=dining&status=pending
```

**쿼리 파라미터**:
| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `activity_type` | string | ❌ | 활동 유형 (dining, sightseeing, cafe, shopping) |
| `status` | string | ❌ | 요청 상태 (pending, accepted, declined) |

#### 응답 (Response 200 OK)
```json
{
  "status": "success",
  "accommodation_id": "acc_001",
  "accommodation_name": "Seoul Guesthouse",
  "filters_applied": {
    "activity_type": "dining",
    "status": "pending"
  },
  "join_requests": [
    {
      "join_id": "join_001",
      "requester_id": "user_123",
      "requester_name": "김철수",
      "activity_type": "dining",
      "status": "pending",
      "message": "명동에서 저녁 식사할 사람 구합니다!",
      "created_at": "2026-07-30T14:00:00Z",
      "created_ago_hours": 2
    },
    {
      "join_id": "join_002",
      "requester_id": "user_456",
      "requester_name": "이순신",
      "activity_type": "dining",
      "status": "pending",
      "message": "한식 맛집 같이 찾아요!",
      "created_at": "2026-07-30T12:30:00Z",
      "created_ago_hours": 3
    }
  ],
  "result_count": 2
}
```

**응답 필드**:
| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | string | "success" 또는 "error" |
| `accommodation_id` | string | 숙소 ID |
| `accommodation_name` | string | 숙소명 |
| `filters_applied` | object | 적용된 필터 |
| `join_requests` | array | 조인 요청 목록 |
| `join_requests[].join_id` | string | 조인 요청 ID |
| `join_requests[].requester_name` | string | 요청자 이름 |
| `join_requests[].activity_type` | string | 활동 유형 |
| `join_requests[].status` | string | 요청 상태 |
| `join_requests[].created_ago_hours` | integer | 요청 생성 후 경과 시간(시간) |
| `result_count` | integer | 반환된 조인 요청 수 |

#### 응답 (Response 404 Not Found)
```json
{
  "status": "error",
  "error_code": "ACCOMMODATION_NOT_FOUND",
  "message": "Accommodation with ID 'acc_001' not found"
}
```

---

### 2.3 모든 숙소 조회 (UI 초기화용)

**`GET /accommodations`**

시스템에 등록된 모든 숙소 목록을 조회합니다. (UI에서 숙소 선택 드롭다운 초기화)

#### 요청 (Request)
```
GET /accommodations
```

#### 응답 (Response 200 OK)
```json
{
  "status": "success",
  "accommodations": [
    {
      "accommodation_id": "acc_001",
      "name": "Seoul Guesthouse",
      "address": "서울시 중구 명동",
      "latitude": 37.5665,
      "longitude": 126.9780
    },
    {
      "accommodation_id": "acc_002",
      "name": "Gangnam House",
      "address": "서울시 강남구 강남역",
      "latitude": 37.4979,
      "longitude": 127.0276
    }
  ],
  "result_count": 2
}
```

---

## 3. 에러 코드 정의

| 에러 코드 | HTTP 상태 | 설명 | 예시 응답 |
|----------|----------|------|---------|
| `ACCOMMODATION_NOT_FOUND` | 404 | 숙소 ID가 DB에 없음 | `{"error_code": "ACCOMMODATION_NOT_FOUND"}` |
| `INVALID_REQUEST` | 400 | 필수 필드 누락 | `{"error_code": "INVALID_REQUEST", "missing_fields": [...]}` |
| `EMPTY_SEARCH_RESULT` | 200* | 반경 내 POI 0개 | `{"status": "success", "nearby_activities": [], "result_count": 0}` |
| `RAG_GENERATION_FAILED` | 500 | RAG 응답 생성 실패 | `{"error_code": "RAG_GENERATION_FAILED", "message": "..."}` |
| `DATABASE_ERROR` | 500 | DB 조회 오류 | `{"error_code": "DATABASE_ERROR"}` |
| `INVALID_FILTER` | 400 | 잘못된 카테고리/상태 필터 | `{"error_code": "INVALID_FILTER", "details": "..."}` |

*주의: EMPTY_SEARCH_RESULT는 기술적 오류가 아니므로 HTTP 200으로 반환하되, result_count가 0임을 명시

---

## 4. 데이터 흐름 (E2E)

```
┌─────────────────────────────────────────────────────────────┐
│                    Streamlit UI (M3)                        │
│  - 숙소 선택 드롭다운 (/accommodations)                      │
│  - 키워드 입력 + 카테고리 필터                               │
│  - [근거리 검색] 버튼 클릭                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
        POST /nearby-search (키워드, 필터)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI Backend (M2)                          │
│  1. 요청 유효성 검사                                        │
│  2. 숙소 좌표 조회 (SQLite)                                 │
│  3. 반경 2km 내 POI 필터링 (haversine)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          RAG Pipeline (PL의 지식베이스 + LLM)               │
│  1. POI 임베딩 검색 (keyword 기반)                          │
│  2. 카테고리 필터 적용                                      │
│  3. 거리 기반 재순위화                                      │
│  4. 사용자 프로필 기반 추천 이유 생성                        │
│  5. 신뢰도 점수 계산                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
        JSON 응답 (nearby_activities[])
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Streamlit UI (M3)                             │
│  - 카드 형식으로 장소 표시                                   │
│  - 거리, 신뢰도, 추천 이유 표시                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 조인 조회 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    Streamlit UI (M3)                        │
│  - 숙소 선택                                                │
│  - [조인 목록 보기] 탭                                      │
│  - 활동 유형 & 상태 필터 선택                               │
└────────────────────┬────────────────────────────────────────┘
                     │
   GET /accommodations/{id}/join-requests?activity_type&status
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI Backend (M2)                          │
│  1. 요청 유효성 검사                                        │
│  2. SQLite에서 join_requests 조회 (필터 적용)               │
│  3. 생성 시간 기준 정렬 (최신순)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
        JSON 응답 (join_requests[])
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Streamlit UI (M3)                             │
│  - 조인 요청 카드 표시                                       │
│  - 요청자명, 활동유형, 메시지, 상태 표시                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 구현 주의사항

### M2 (백엔드)
- **하버사인 거리 계산**: 모든 거리는 haversine 공식으로 계산 (단위: 미터)
- **고정 반경**: `/nearby-search` 요청에서 반경은 항상 2000m로 처리 (요청 파라미터 무시)
- **카테고리 필터**: 요청된 카테고리가 POI에 정확히 매칭되지 않을 수 있으므로, 사전에 카테고리 매핑 테이블 작성
- **빈 결과 처리**: POI가 0개일 때도 HTTP 200으로 응답하되, `nearby_activities: []`, `result_count: 0`
- **타임스탬프**: 모든 created_at은 ISO 8601 형식 (예: `2026-07-30T14:00:00Z`)

### M3 (프론트엔드)
- **UI 초기 로딩**: 페이지 로드 시 `/accommodations` 호출하여 드롭다운 채우기
- **검색 대기**: `/nearby-search` 호출 중에는 로딩 스피너 표시
- **에러 메시지**: status가 "error"면 사용자 친화적 메시지 표시 (기술적 오류는 콘솔 로그)
- **데이터 표시**: POI 카드는 거리 순서로 정렬하여 표시
- **조인 요청 상태**: 상태별로 다른 색상 (pending: 노란색, accepted: 초록색, declined: 회색)

### PL (RAG)
- **신뢰도 점수**: 0.0~1.0 범위, 소수점 2자리까지 (예: 0.92)
- **할루시네이션율**: 평가 단계에서 계산, 응답에 포함
- **추천 이유**: 거리 + 사용자 프로필(혼자 여행)을 함께 고려한 자연스러운 문장
- **프롬프트**: 반드시 POI 이름을 명시하고, 확인되지 않은 정보는 "~일 것 같습니다" 표현 금지

---

## 7. 데이터베이스 스키마 (SQLite)

```sql
-- 숙소
CREATE TABLE accommodations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- POI (근거리 장소)
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 조인 요청
CREATE TABLE join_requests (
  id TEXT PRIMARY KEY,
  accommodation_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (accommodation_id) REFERENCES accommodations(id)
);

-- 인덱스 (검색 성능 최적화)
CREATE INDEX idx_pois_category ON pois(category);
CREATE INDEX idx_join_requests_accommodation_id ON join_requests(accommodation_id);
CREATE INDEX idx_join_requests_status ON join_requests(status);
```

---

## 8. 체크리스트 (7월 30일 오전)

PL이 이 문서를 작성한 후:

- [x] M2와 함께 엔드포인트 리뷰 (30분)
- [x] M3와 함께 응답 JSON 필드 리뷰 (20분)
- [x] 카테고리 매핑 테이블 협의 (M1, M2) (10분)
- [x] 리포지토리에 `api_contract.md` 커밋
- [ ] **이 문서는 7월 31일 종료 후 변경 불가 → 필수 피드백은 지금 반영**

---

**최종 확정**: 2026년 7월 30일