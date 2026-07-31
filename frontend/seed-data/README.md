# Bucket Jeju M3 15일 Join 시드 데이터

> **합성 데이터 안내:** 이 폴더의 모든 투숙객·닉네임·객실·침대·숙박기간·조인 요청 및 참여 관계는 M3 개발·디자인·테스트를 위해 임의 생성한 가상 데이터입니다. 실제 인물, 숙박 기록, 예약 또는 모임을 나타내지 않습니다.

## 데이터 구성

- 가상 투숙객 30명
- 조인 요청 60건
- 2026-08-01부터 2026-08-15까지 15일
- 하루 4건씩 균등 배치
- 숙소 구분 없음
- 객실·침대는 실제 객실 정원 범위에서 중복 없이 임의 배정
- 닉네임만 사용하며 이름·이메일·전화번호는 포함하지 않음
- 고정 난수 seed `20260731`을 사용하여 언제나 같은 결과 재생성

## 투숙객 필드

- `id`, `nickname`
- `checkInDate`, `checkOutDate`
- `roomNumber`, `bedNumber`, `bedKey`
- `interests`, `profileKeywords`
- `stayVerificationStatus`
- `isSynthetic`

## Join 필드

- `id`, `title`, `description`
- `category`, `keywords`
- `scheduledDate`, `scheduledTime`, `location`
- `hostGuestId`, `hostNickname`
- `maxParticipants`, `currentParticipants`
- `status`, `participantGuestIds`
- `isSynthetic`

## 키워드 범위

운동·러닝·산책·트레킹·요가·자전거·플로깅·식사·혼밥탈출·고기국수·흑돼지·카페·디저트·사진·필름사진·일출·노을·별보기·독서·오름·해변·숲·시장·섬여행·로컬문화·친목·대화·드라이브 등을 사용합니다.

## 재생성

```bash
node frontend/seed-data/generate-seed.mjs
```

## 검수 기준

- `guests.length === 30`
- `joinRequests.length === 60`
- 조인 일정이 정확히 15일 안에 존재
- 날짜별 조인이 4건씩 존재
- 작성자와 참여자가 해당 일정에 투숙 중
- 닉네임과 배정 침대가 중복되지 않음
- 모든 레코드의 `isSynthetic === true`
- `currentParticipants <= maxParticipants`

