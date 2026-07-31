# Bucket Jeju M3 Join 시드 데이터

> **합성 데이터 안내:** 이 폴더의 모든 투숙객, 닉네임, 관심사, 조인 요청 및 참여 관계는 M3 개발·디자인·테스트를 위해 생성한 가상 데이터입니다. 실제 인물, 실제 숙박 기록, 실제 예약 또는 실제 모임을 나타내지 않습니다.

## 구성

- `bucket-jeju-m3-seed.synthetic.json`
  - 가상 투숙객 30명
  - 조인 요청 60건
  - 숙소 구분 없음
  - 닉네임만 사용하며 이름·이메일·전화번호 등 개인정보는 포함하지 않음
- `generate-seed.mjs`
  - 동일한 결과를 재생성하는 결정적 생성 스크립트

## 데이터 구조

### `guests`

- `id`: 내부 참조용 가상 ID
- `nickname`: 서비스에 표시되는 닉네임
- `interests`: 관심 키워드
- `profileKeywords`: 프로필 테스트용 최대 5개 키워드
- `isSynthetic`: 항상 `true`

### `joinRequests`

- `id`, `title`, `description`
- `category`, `keywords`
- `scheduledDate`, `scheduledTime`, `location`
- `hostGuestId`, `hostNickname`
- `maxParticipants`, `currentParticipants`
- `status`: `모집중`, `모집완료`, `일정완료`
- `participantGuestIds`
- `isSynthetic`: 항상 `true`

## 사용

```bash
node frontend/seed-data/generate-seed.mjs
```

생성된 JSON의 첫 필드 `_notice`와 `_meta.synthetic`, 각 레코드의 `isSynthetic` 값으로 합성 데이터 여부를 확인할 수 있습니다.

## 검수 기준

- `guests.length === 30`
- `joinRequests.length === 60`
- 모든 닉네임은 중복되지 않음
- 모든 `hostGuestId` 및 `participantGuestIds`는 `guests`에 존재
- 모든 레코드의 `isSynthetic === true`
- `currentParticipants <= maxParticipants`

