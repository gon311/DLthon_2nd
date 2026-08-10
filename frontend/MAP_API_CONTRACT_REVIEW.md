# 카카오맵·반경 2km API 계약 검토

작성일: 2026-07-31  
대상: `API Contract 0730`, 프로젝트 허브, 화면 목록·유저 플로우, 필요 데이터 및 레퍼런스

## 기준 위치

- 이름: 버킷 제주
- 주소: 제주특별자치도 서귀포시 대정읍 하모백사로14번길 1
- 위도: `33.2124518`
- 경도: `126.2598287`
- 서비스 반경: `2,000m`

좌표는 프로젝트의 고정 중심값으로 사용한다. 운영 전 카카오 장소 검색 결과의
공식 장소 ID·도로명주소와 마지막으로 대조한 후 환경 설정 또는 서버 설정으로
관리한다. 클라이언트가 임의의 중심 좌표를 넘겨 검색 범위를 바꾸지 못하게 한다.

## 화면 요구사항

- 지도 중심과 버킷 제주 마커를 고정한다.
- 반경 2km 원을 지도 위에 표시한다.
- `버킷 제주 기준 반경 2km` 배지를 항상 노출한다.
- 장소 카드에는 직선거리 `distanceMeters`를 표시한다.
- 카카오 검색 결과도 Haversine 거리로 재검증해 2,000m 초과 항목을 제거한다.
- 카카오 JavaScript 키는 허용 도메인을 제한한다.
- REST API 키와 Admin 키는 브라우저에 전달하지 않는다.

## 계약 변경안

### 1. 주변 장소

기존:

```http
GET /recommendations?lat&lng
```

권장:

```http
GET /places/nearby?category=food&keyword=&cursor=
```

서버가 버킷 제주의 중심 좌표와 `radiusMeters=2000`을 강제한다.

```json
{
  "center": {
    "name": "버킷 제주",
    "latitude": 33.2124518,
    "longitude": 126.2598287
  },
  "radiusMeters": 2000,
  "distanceType": "STRAIGHT_LINE",
  "items": [
    {
      "id": "kakao-place-id",
      "name": "장소명",
      "category": "food",
      "distanceMeters": 430,
      "latitude": 33.2101,
      "longitude": 126.2622,
      "roadAddress": "도로명 주소",
      "source": "KAKAO"
    }
  ],
  "nextCursor": null
}
```

### 2. AI 챗의 POI

`POST /chat`의 근거 POI에도 다음 필드를 공통 적용한다.

- `id`, `name`, `category`
- `latitude`, `longitude`
- `distanceMeters`
- `source`
- `isWithinServiceRadius`

`isWithinServiceRadius=false`인 장소는 응답에서 제거하는 것을 원칙으로 한다.

### 3. 조인 장소

`POST /joins`에 다음 필드를 추가한다.

```json
{
  "title": "저녁 같이 먹어요",
  "description": "혼밥 대신 함께 먹어요.",
  "category": "MEAL",
  "scheduledAt": "2026-08-01T19:00:00+09:00",
  "maxParticipants": 4,
  "placeId": "kakao-place-id",
  "placeName": "장소명",
  "latitude": 33.2101,
  "longitude": 126.2622
}
```

서버는 조인 생성 시 장소가 반경 2km 안인지 다시 검증한다.

### 4. 사용자 정책

서비스 정책이 닉네임 전용이라면 `/me`에서 이름·이메일·전화번호를 다루지 않는다.
연령대·성별도 필수 필드로 두지 않고 다음 수준으로 최소화한다.

```json
{
  "id": "guest-001",
  "nickname": "귤빛파도",
  "profileKeywords": ["러닝", "노을", "식사"],
  "keywordScores": [
    {"keyword": "러닝", "score": 82}
  ]
}
```

테스트 UI는 `profileKeywords` 또는 `keywordScores` 중 상위 5개만 표시한다.

### 5. 공통 오류

```json
{
  "error": {
    "code": "OUTSIDE_SERVICE_RADIUS",
    "message": "버킷 제주 기준 반경 2km 밖의 장소입니다.",
    "details": {"radiusMeters": 2000}
  }
}
```

권장 상태 코드:

- `400 INVALID_QUERY`
- `404 PLACE_NOT_FOUND`
- `409 JOIN_FULL`
- `422 OUTSIDE_SERVICE_RADIUS`
- `429 UPSTREAM_RATE_LIMITED`
- `502 KAKAO_UPSTREAM_ERROR`

## 문서 간 정리 필요 사항

1. 프로젝트 허브는 프론트를 Streamlit으로, 일정 문서는 Next.js로 적고 있으므로 하나로 확정한다.
2. 데이터 문서의 반경 `3km`를 제품 기준인 `2km`로 수정한다.
3. `/recommendations?lat&lng`의 임의 좌표 입력을 제거하고 서버 고정 중심을 사용한다.
4. 한글 필드명 예시는 실제 JSON 키 규칙인 영문 `camelCase`로 통일한다.
5. 모든 목록 API에 페이지네이션과 빈 결과 형식을 정의한다.
6. 날짜·시간은 `Asia/Seoul` 오프셋을 포함한 ISO 8601로 통일한다.
7. 닉네임 전용 정책과 충돌하는 연령대·성별 필수 입력을 제거하거나 선택값으로 바꾼다.
8. 카카오 장애·쿼터 초과·검색 결과 0건에 대한 프론트 상태를 계약에 추가한다.
9. 직선거리와 실제 도보거리의 차이를 화면 및 계약에 명시한다.
10. API 키 종류와 보관 위치(JavaScript 키=프론트, REST 키=서버)를 문서에 명시한다.

