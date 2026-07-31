import { writeFileSync } from "node:fs";

const generatedAt = "2026-07-31T09:00:00+09:00";
const syntheticNotice =
  "SYNTHETIC DATA: 이 파일의 모든 투숙객·닉네임·조인 요청은 M3 개발 및 테스트를 위해 생성한 가상 데이터이며 실제 인물이나 실제 예약을 나타내지 않습니다.";

const nicknames = [
  "귤빛파도", "오름한스푼", "돌담산책", "한라구름", "바람소라",
  "노을러너", "해녀의별", "모슬포참새", "산방산콩", "우도땅콩",
  "새별오름달", "협재물결", "곶자왈토끼", "애월필름", "성산해돋이",
  "제주책갈피", "감귤마카롱", "파도타는귤", "오름이", "하모바다",
  "돌고래우체부", "동백여행자", "푸른현무암", "귤꽃향기", "바당친구",
  "숲길메아리", "노꼬메구름", "용머리노을", "비자림새", "제주한바퀴",
];

const guestStyles = [
  ["러닝", "운동", "노을"], ["오름", "트레킹", "사진"], ["산책", "카페", "대화"],
  ["등산", "자연", "일출"], ["해변", "서핑", "음악"], ["러닝", "건강", "아침"],
  ["로컬문화", "식사", "바다"], ["맛집", "시장", "여행"], ["사진", "오름", "디저트"],
  ["자전거", "해변", "간식"], ["별보기", "오름", "캠핑"], ["수영", "산책", "노을"],
  ["숲", "명상", "산책"], ["필름사진", "카페", "일몰"], ["일출", "트레킹", "식사"],
  ["독서", "카페", "조용한여행"], ["디저트", "사진", "시장"], ["서핑", "러닝", "식사"],
  ["맛집", "산책", "로컬"], ["해변", "낚시", "노을"], ["돌고래", "드라이브", "사진"],
  ["동백", "정원", "산책"], ["지질", "트레킹", "자연"], ["꽃", "카페", "사진"],
  ["바다", "수영", "친목"], ["숲길", "러닝", "명상"], ["오름", "등산", "노을"],
  ["해안", "산책", "사진"], ["비자림", "자연", "독서"], ["여행", "맛집", "친목"],
];

const guests = nicknames.map((nickname, index) => ({
  id: `guest-${String(index + 1).padStart(3, "0")}`,
  nickname,
  interests: guestStyles[index],
  profileKeywords: guestStyles[index].slice(0, 5),
  isSynthetic: true,
}));

const joinTemplates = [
  ["하모해변 노을 러닝", "하모해변을 따라 가볍게 달린 뒤 함께 노을을 봐요. 초보 러너도 환영합니다.", "운동", "하모해변", ["러닝", "노을"]],
  ["모슬포 고기국수 저녁", "혼밥 대신 따뜻한 고기국수를 같이 먹어요. 메뉴는 현장에서 정해도 좋아요.", "식사", "버킷 제주 로비", ["식사", "로컬맛집"]],
  ["송악산 둘레길 산책", "천천히 풍경을 보며 송악산 둘레길을 걸어요. 편한 신발만 챙겨 오세요.", "여행", "송악산 주차장", ["산책", "트레킹"]],
  ["산방산 일출 사진", "이른 아침 산방산 풍경을 함께 촬영해요. 휴대폰 카메라도 충분합니다.", "여행", "산방산 입구", ["사진", "일출"]],
  ["대정오일시장 간식 투어", "시장 간식을 조금씩 나눠 먹으며 대정의 맛을 찾아봐요.", "식사", "대정오일시장 입구", ["시장", "간식"]],
  ["용머리해안 지질 산책", "용머리해안의 독특한 지층을 구경하며 느긋하게 걸어요.", "여행", "용머리해안 매표소", ["지질", "산책"]],
  ["모슬포항 새벽 산책", "조용한 항구의 아침 공기를 함께 느껴요. 따뜻한 겉옷을 추천해요.", "운동", "모슬포항", ["아침", "산책"]],
  ["제주 로컬 카페 탐방", "대정읍의 작은 카페 두 곳을 골라 천천히 둘러봐요.", "카페", "버킷 제주 입구", ["카페", "대화"]],
  ["가파도 자전거 한 바퀴", "배를 타고 가파도에 들어가 자전거로 섬을 둘러봐요.", "여행", "운진항", ["자전거", "섬여행"]],
  ["해변 요가 스트레칭", "하모해변에서 여행으로 굳은 몸을 가볍게 풀어요. 매트는 선택이에요.", "운동", "하모해변", ["요가", "건강"]],
  ["제주 흑돼지 같이 먹기", "여럿이 먹으면 더 맛있는 흑돼지 저녁 모임이에요.", "식사", "버킷 제주 로비", ["식사", "흑돼지"]],
  ["노을 필름사진 산책", "해 질 무렵 골목과 바다를 필름 감성으로 담아봐요.", "여행", "하모체육공원", ["사진", "노을"]],
  ["편의점 간식 월드컵", "각자 추천하는 제주 간식을 하나씩 골라 재미있게 맛봐요.", "친목", "버킷 제주 공용공간", ["간식", "친목"]],
  ["여행책 한 챕터 읽기", "각자 읽던 책을 가져와 조용히 읽고 짧게 감상을 나눠요.", "친목", "버킷 제주 라운지", ["독서", "대화"]],
  ["곶자왈 숲길 트레킹", "제주의 숲 냄새를 느끼며 무리하지 않는 속도로 걸어요.", "여행", "곶자왈 도립공원", ["숲", "트레킹"]],
  ["아침 해장국 원정대", "일찍 일어난 사람끼리 든든한 제주식 해장국을 먹으러 가요.", "식사", "버킷 제주 입구", ["아침", "식사"]],
  ["별 보며 여행 이야기", "날씨가 맑으면 야외에서 별을 보고 서로의 제주 일정을 나눠요.", "친목", "하모해변", ["별보기", "대화"]],
  ["대정쌍둥이식당 점심", "대정쌍둥이식당에서 점심을 같이 먹을 분을 찾아요.", "식사", "대정쌍둥이식당", ["식사", "로컬맛집"]],
  ["바닷가 플로깅", "산책하며 작은 쓰레기를 줍는 가벼운 플로깅 모임이에요.", "운동", "하모해변", ["플로깅", "산책"]],
  ["체크아웃 전 브런치", "체크아웃 전 가까운 곳에서 여유롭게 브런치를 먹어요.", "식사", "버킷 제주 로비", ["브런치", "대화"]],
];

const statuses = ["모집중", "모집중", "모집중", "모집완료", "일정완료"];
const dates = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"];
const times = ["07:00", "09:30", "12:00", "15:30", "18:30", "20:00"];

const joinRequests = Array.from({ length: 60 }, (_, index) => {
  const template = joinTemplates[index % joinTemplates.length];
  const status = statuses[index % statuses.length];
  const maxParticipants = 3 + (index % 6);
  const currentParticipants =
    status === "모집완료" ? maxParticipants :
    status === "일정완료" ? Math.max(2, maxParticipants - 1) :
    1 + (index % Math.max(1, maxParticipants - 1));

  return {
    id: `join-${String(index + 1).padStart(3, "0")}`,
    title: `${template[0]}${index >= 20 ? ` ${Math.floor(index / 20) + 1}차` : ""}`,
    description: template[1],
    category: template[2],
    keywords: template[4],
    scheduledDate: dates[index % dates.length],
    scheduledTime: times[index % times.length],
    location: template[3],
    hostGuestId: guests[index % guests.length].id,
    hostNickname: guests[index % guests.length].nickname,
    maxParticipants,
    currentParticipants,
    status,
    participantGuestIds: Array.from(
      { length: Math.max(0, currentParticipants - 1) },
      (_, participantIndex) => guests[(index + participantIndex + 1) % guests.length].id,
    ),
    isSynthetic: true,
  };
});

const seed = {
  _notice: syntheticNotice,
  _meta: {
    datasetName: "Bucket Jeju M3 Join Seed Dataset",
    version: "1.0.0",
    generatedAt,
    locale: "ko-KR",
    synthetic: true,
    guestCount: guests.length,
    joinRequestCount: joinRequests.length,
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

