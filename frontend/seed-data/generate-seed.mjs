import { writeFileSync } from "node:fs";

const generatedAt = "2026-08-04T18:20:00+09:00";
const scheduleStart = "2026-08-05";
const scheduleDays = 15;
const syntheticNotice =
  "SYNTHETIC DATA: 이 파일의 모든 투숙객·닉네임·객실·침대·숙박기간·조인 요청은 M3 개발 및 테스트를 위해 임의 생성한 합성 데이터이며 실제 인물, 예약 또는 모임을 나타내지 않습니다.";

// 같은 seed로 언제든 같은 테스트 데이터를 재생성한다.
let randomState = 20260731;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 4294967296;
}
function pick(items) {
  return items[Math.floor(random() * items.length)];
}
function addDays(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

const nicknames = [
  "귤빛파도", "오름한스푼", "돌담산책", "한라구름", "바람소라",
  "노을러너", "해녀의별", "모슬포참새", "산방산콩", "우도땅콩",
  "새별오름달", "협재물결", "곶자왈토끼", "애월필름", "성산해돋이",
  "제주책갈피", "감귤마카롱", "파도타는귤", "오름이", "하모바다",
  "돌고래우체부", "동백여행자", "푸른현무암", "귤꽃향기", "바당친구",
  "숲길메아리", "노꼬메구름", "용머리노을", "비자림새", "제주한바퀴",
];
const syntheticIdentities = [
  ["김하린","여성","대한민국"],["이도윤","남성","대한민국"],["박서아","여성","대한민국"],["최민준","남성","대한민국"],
  ["사토 유이","여성","일본"],["다나카 렌","남성","일본"],["왕신위","여성","중국"],["리웨이","남성","중국"],
  ["에밀리 첸","여성","싱가포르"],["노아 탄","남성","싱가포르"],["소피 마틴","여성","프랑스"],["뤼카 베르나르","남성","프랑스"],
  ["에마 윌슨","여성","영국"],["올리버 브라운","남성","영국"],["미아 존슨","여성","미국"],["이선 데이비스","남성","미국"],
  ["클라라 뮐러","여성","독일"],["레온 슈미트","남성","독일"],["소피아 로시","여성","이탈리아"],["마테오 콘티","남성","이탈리아"],
  ["이사벨라 가르시아","여성","스페인"],["디에고 로페스","남성","스페인"],["올리비아 스미스","여성","호주"],["잭 테일러","남성","호주"],
  ["메이 린","여성","말레이시아"],["아담 라만","남성","말레이시아"],["안야 샤르마","여성","인도"],["아르준 파텔","남성","인도"],
  ["린 응우옌","여성","베트남"],["민 쩐","남성","베트남"],
];

const keywordPool = [
  "러닝", "산책", "트레킹", "요가", "자전거", "수영", "플로깅",
  "식사", "혼밥탈출", "고기국수", "흑돼지", "해산물", "브런치", "디저트",
  "카페", "사진", "필름사진", "일출", "노을", "별보기", "독서",
  "오름", "해변", "숲", "시장", "섬여행", "로컬문화", "친목", "대화", "드라이브",
];

const roomCapacities = {
  "101": 8, "201": 8, "202": 6, "203": 6,
  "206": 4, "207": 8, "302A": 4, "302B": 4,
};
const availableBeds = Object.entries(roomCapacities).flatMap(([roomNumber, capacity]) =>
  Array.from({ length: capacity }, (_, index) => ({
    roomNumber,
    bedNumber: index + 1,
    bedKey: `${roomNumber}-B${String(index + 1).padStart(2, "0")}`,
  })),
);
// Fisher-Yates 셔플 후 30개 침대를 중복 없이 배정한다.
for (let index = availableBeds.length - 1; index > 0; index -= 1) {
  const swapIndex = Math.floor(random() * (index + 1));
  [availableBeds[index], availableBeds[swapIndex]] =
    [availableBeds[swapIndex], availableBeds[index]];
}

const guests = nicknames.map((nickname, index) => {
  const interests = [...keywordPool]
    .sort(() => random() - 0.5)
    .slice(0, 5);
  const checkInDate = index < 10
    ? pick(["2026-08-04", "2026-08-05"])
    : addDays("2026-08-03", Math.floor(random() * 6));
  const checkOutDate = index < 10
    ? "2026-08-20"
    : addDays(checkInDate, 7 + Math.floor(random() * 9));

  return {
    id: `guest-${String(index + 1).padStart(3, "0")}`,
    testAccountId: `TEST-${String(index + 1).padStart(3, "0")}`,
    nickname,
    syntheticName: syntheticIdentities[index][0],
    gender: syntheticIdentities[index][1],
    nationality: syntheticIdentities[index][2],
    checkInDate,
    checkOutDate,
    ...availableBeds[index],
    interests,
    profileKeywords: interests.slice(0, 5),
    stayVerificationStatus: "인증완료",
    isSynthetic: true,
  };
});

const joinTemplates = [
  ["하모해변 노을 러닝", "하모해변을 따라 가볍게 달린 뒤 함께 노을을 봐요.", "운동", "하모해변", ["러닝", "노을", "해변"]],
  ["모슬포 고기국수 저녁", "혼밥 대신 따뜻한 고기국수를 같이 먹어요.", "식사", "버킷 제주 로비", ["식사", "고기국수", "혼밥탈출"]],
  ["송악산 둘레길 산책", "풍경을 보며 무리하지 않는 속도로 걸어요.", "여행", "송악산 주차장", ["산책", "트레킹", "오름"]],
  ["산방산 일출 사진", "휴대폰이나 카메라로 산방산의 아침을 담아요.", "사진", "산방산 입구", ["사진", "일출", "오름"]],
  ["대정오일시장 간식 투어", "시장 간식을 조금씩 나눠 먹으며 둘러봐요.", "식사", "대정오일시장 입구", ["시장", "식사", "로컬문화"]],
  ["용머리해안 지질 산책", "독특한 지층과 바다 풍경을 천천히 구경해요.", "여행", "용머리해안 매표소", ["산책", "사진", "해변"]],
  ["모슬포항 새벽 산책", "조용한 항구의 아침 공기를 함께 느껴요.", "운동", "모슬포항", ["산책", "일출", "해변"]],
  ["대정 로컬 카페 탐방", "작은 카페 두 곳을 골라 천천히 둘러봐요.", "카페", "버킷 제주 입구", ["카페", "디저트", "대화"]],
  ["가파도 자전거 한 바퀴", "가파도에 들어가 자전거로 섬을 둘러봐요.", "여행", "운진항", ["자전거", "섬여행", "사진"]],
  ["해변 요가 스트레칭", "여행으로 굳은 몸을 바닷바람과 함께 풀어요.", "운동", "하모해변", ["요가", "해변", "산책"]],
  ["제주 흑돼지 같이 먹기", "여럿이 먹으면 더 맛있는 흑돼지 저녁 모임이에요.", "식사", "버킷 제주 로비", ["식사", "흑돼지", "친목"]],
  ["노을 필름사진 산책", "골목과 바다를 필름 감성으로 담아봐요.", "사진", "하모체육공원", ["필름사진", "노을", "산책"]],
  ["편의점 간식 월드컵", "각자 추천하는 제주 간식을 골라 맛봐요.", "친목", "버킷 제주 공용공간", ["친목", "디저트", "대화"]],
  ["여행책 한 챕터 읽기", "각자 책을 읽고 짧게 감상을 나눠요.", "친목", "버킷 제주 라운지", ["독서", "카페", "대화"]],
  ["곶자왈 숲길 트레킹", "제주의 숲 냄새를 느끼며 천천히 걸어요.", "여행", "곶자왈 도립공원", ["숲", "트레킹", "사진"]],
  ["아침 해장국 원정대", "일찍 일어난 사람끼리 든든하게 아침을 먹어요.", "식사", "버킷 제주 입구", ["식사", "혼밥탈출", "로컬문화"]],
  ["별 보며 여행 이야기", "별을 보며 서로의 제주 일정을 나눠요.", "친목", "하모해변", ["별보기", "대화", "해변"]],
  ["대정쌍둥이식당 점심", "대정쌍둥이식당에서 점심을 같이 먹어요.", "식사", "대정쌍둥이식당", ["식사", "혼밥탈출", "로컬문화"]],
  ["바닷가 플로깅", "산책하며 작은 쓰레기를 줍는 가벼운 모임이에요.", "운동", "하모해변", ["플로깅", "산책", "해변"]],
  ["제주 남서쪽 드라이브", "근처 전망 포인트를 골라 짧게 드라이브해요.", "여행", "버킷 제주 주차장", ["드라이브", "노을", "사진"]],
];

const statuses = ["모집중", "모집중", "모집중", "모집완료"];
const times = ["07:00", "09:30", "12:00", "15:30", "18:30", "20:00"];

// 총 60건을 15일에 불균등하게 배정한다.
// 일별 건수 구성은 1~7건이며, 날짜 배치는 고정 난수 seed로 섞어 재현한다.
const dailyJoinCounts = [1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 5, 5, 6, 6, 7];
for (let index = dailyJoinCounts.length - 1; index > 0; index -= 1) {
  const swapIndex = Math.floor(random() * (index + 1));
  [dailyJoinCounts[index], dailyJoinCounts[swapIndex]] =
    [dailyJoinCounts[swapIndex], dailyJoinCounts[index]];
}
const joinDayOffsets = dailyJoinCounts.flatMap((count, dayOffset) =>
  Array.from({ length: count }, () => dayOffset),
);
const joinDistribution = Object.fromEntries(
  dailyJoinCounts.map((count, dayOffset) => [addDays(scheduleStart, dayOffset), count]),
);

const joinRequests = Array.from({ length: 60 }, (_, index) => {
  const dayOffset = joinDayOffsets[index];
  const scheduledDate = addDays(scheduleStart, dayOffset);
  const eligibleGuests = guests.filter(
    (guest) => guest.checkInDate <= scheduledDate && scheduledDate < guest.checkOutDate,
  );
  const template = joinTemplates[index % joinTemplates.length];
  const host = eligibleGuests[index % eligibleGuests.length];
  const status = statuses[index % statuses.length];
  const maxParticipants = 3 + (index % 6);
  const participantPool = eligibleGuests.filter((guest) => guest.id !== host.id);
  const targetParticipantCount = status === "모집완료"
    ? maxParticipants - 1
    : Math.min(1 + (index % 3), maxParticipants - 2);
  const participants = Array.from(
    { length: Math.min(targetParticipantCount, participantPool.length) },
    (_, participantIndex) => participantPool[(index + participantIndex) % participantPool.length],
  );

  return {
    id: `join-${String(index + 1).padStart(3, "0")}`,
    title: `${template[0]} ${dayOffset + 1}일차`,
    description: template[1],
    category: template[2],
    keywords: template[4],
    scheduledDate,
    scheduledTime: times[index % times.length],
    location: template[3],
    hostGuestId: host.id,
    hostNickname: host.nickname,
    maxParticipants,
    currentParticipants: participants.length + 1,
    status,
    participantGuestIds: participants.map((guest) => guest.id),
    isSynthetic: true,
  };
});

const seed = {
  _notice: syntheticNotice,
  _meta: {
    datasetName: "Bucket Jeju M3 15-Day Join Seed Dataset",
    version: "4.0.0",
    generatedAt,
    locale: "ko-KR",
    synthetic: true,
    randomSeed: 20260731,
    guestCount: guests.length,
    joinRequestCount: joinRequests.length,
    scheduleStart,
    scheduleEnd: addDays(scheduleStart, scheduleDays - 1),
    scheduleDays,
    joinDistribution,
    minimumJoinsPerDay: Math.min(...dailyJoinCounts),
    maximumJoinsPerDay: Math.max(...dailyJoinCounts),
    lodgingSeparationUsed: false,
  },
  guests,
  joinRequests,
};

writeFileSync(
  new URL("./bucket-jeju-m3-seed.synthetic.json", import.meta.url),
  `${JSON.stringify(seed, null, 2)}\n`,
  "utf8",
);

