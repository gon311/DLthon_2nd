"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";
import syntheticSeed from "../seed-data/bucket-jeju-m3-seed.synthetic.json";
import { guesthouseFaq, localeCopy, type GuesthouseLocale } from "../seed-data/guesthouse-faq";
type Tab = "home" | "place" | "join" | "ask" | "profile";
type JoinStatus = "모집중" | "모집완료" | "일정완료";
type AskMessage = { role: "user" | "assistant"; text: string; sources?: string[] };

const bucketKnowledge = [
  { name: "대정쌍둥이식당", description: "저렴한 가격에 맛있는 한식을 즐길 수 있고 혼자 방문하기 좋은 곳", distance: "약 100m", tags: ["맛집", "식당", "한식", "혼밥", "먹"] },
  { name: "산방산접짝뼈&돌우럭", description: "제주식 접짝뼈와 돌우럭 요리를 맛볼 수 있고 혼자 방문하기 좋은 식당", distance: "약 230m", tags: ["맛집", "식당", "해산물", "혼밥", "먹"] },
  { name: "25시해장국", description: "24시간 운영되는 해장국 전문점으로 늦은 시간 식사에 알맞은 곳", distance: "약 240m", tags: ["맛집", "식당", "해장국", "24시간", "밤", "혼밥", "먹"] },
  { name: "하모해변", description: "자연스러운 해안 풍경을 감상하며 가볍게 걷기 좋은 해변", distance: "약 140m", tags: ["관광", "해변", "산책", "바다", "걷"] },
  { name: "방어축제의거리", description: "모슬포의 음식과 지역 문화를 함께 느낄 수 있는 거리", distance: "약 1.1km", tags: ["관광", "문화", "산책", "거리"] },
  { name: "CU 서귀최남단해안로점", description: "해안로에서 간식과 여행용품을 구입하기 편한 편의점", distance: "약 260m", tags: ["편의점", "간식", "생필품", "편의"] },
  { name: "모슬포낚시편의점", description: "간식과 낚시 편의용품을 함께 판매하는 가까운 편의점", distance: "약 270m", tags: ["편의점", "낚시", "간식", "편의"] },
];

// 버킷제주 고정 위치와 정보 제공 경계(울타리) 반경
const BUCKET_ORIGIN: [number, number] = [33.2124518, 126.2598287];
const COVERAGE_RADIUS_M = 2000; // 반경 2km

// 근처 플레이스 카테고리와 이모지
const PLACE_CATEGORIES: { key: string; emoji: string }[] = [
  { key: "식당", emoji: "🍽️" },
  { key: "편의점", emoji: "🏪" },
  { key: "해변", emoji: "🏖️" },
  { key: "관광", emoji: "📷" },
  { key: "주차장", emoji: "🅿️" },
];
const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(PLACE_CATEGORIES.map((c) => [c.key, c.emoji]));

type MapPlace = { name: string; category: string; lat: number; lng: number; distance: string };
const PLACE_DETAIL_COPY: Record<string, string> = {
  "식당": "제주에서 식사하기 좋은 곳이에요. 방문 전 영업시간과 대기 여부를 지도에서 확인해 주세요.",
  "편의점": "간식과 여행용품을 준비하기 편한 곳이에요.",
  "해변": "제주의 바다 풍경을 즐기며 가볍게 산책하기 좋은 곳이에요.",
  "관광": "버킷제주 주변의 제주 풍경과 이야기를 만날 수 있는 장소예요.",
  "선착장": "배편과 해안 이동 정보를 확인할 수 있는 선착장이에요. 운항 정보는 방문 전에 확인해 주세요.",
  "주차장": "차량으로 주변 장소를 둘러볼 때 이용할 수 있는 주차 장소예요.",
  "카페": "잠시 쉬면서 음료와 제주 분위기를 즐기기 좋은 곳이에요.",
  "베이커리": "빵과 간단한 간식을 준비하기 좋은 곳이에요.",
  "약국": "여행 중 필요한 일반 의약품과 건강용품을 찾을 수 있는 곳이에요.",
  "의료": "여행 중 진료나 건강 상담이 필요할 때 확인할 수 있는 의료시설이에요.",
  "시장": "제주 지역 먹거리와 생활 풍경을 둘러보기 좋은 시장이에요.",
  "마트": "식료품과 여행 생필품을 한 번에 준비하기 좋은 곳이에요.",
  "공원": "가볍게 걷거나 쉬면서 주변 풍경을 즐기기 좋은 곳이에요.",
  "문화": "제주의 역사와 지역 문화를 살펴볼 수 있는 장소예요.",
  "전망": "제주 바다와 주변 풍경을 한눈에 감상하기 좋은 지점이에요.",
};
// 버킷제주(33.2124518, 126.2598287) 반경 2km 내 실제 POI — kakao_local 실좌표(data/processed/guesthouse_pois.csv) 기준, 검수 반영
const mapPlaces: MapPlace[] = [
  { name: "대정쌍둥이식당", category: "식당", lat: 33.211598, lng: 126.259427, distance: "약 100m" },
  { name: "하모해변", category: "해변", lat: 33.211065, lng: 126.260753, distance: "약 180m" },
  { name: "산방산접짝뼈&돌우럭", category: "식당", lat: 33.211713, lng: 126.257614, distance: "약 220m" },
  { name: "25시해장국", category: "식당", lat: 33.211676, lng: 126.257462, distance: "약 240m" },
  { name: "제주사쿠 모슬포본점", category: "식당", lat: 33.211492, lng: 126.257444, distance: "약 250m" },
  { name: "CU 서귀최남단해안로점", category: "편의점", lat: 33.211653, lng: 126.257076, distance: "약 270m" },
  { name: "모슬포낚시편의점", category: "편의점", lat: 33.211659, lng: 126.257033, distance: "약 270m" },
  { name: "영희네휴게점", category: "식당", lat: 33.209907, lng: 126.259018, distance: "약 290m" },
  { name: "이든모아휴게점", category: "식당", lat: 33.209903, lng: 126.258851, distance: "약 300m" },
  { name: "신모슬포포구식당", category: "식당", lat: 33.211512, lng: 126.256502, distance: "약 330m" },
  { name: "M1971 요트투어 주차장", category: "주차장", lat: 33.210502, lng: 126.257077, distance: "약 340m" },
  { name: "소쿠리밥상", category: "식당", lat: 33.215009, lng: 126.257897, distance: "약 340m" },
  { name: "모슬포왕곰탕", category: "식당", lat: 33.215205, lng: 126.257918, distance: "약 350m" },
  { name: "하모반점", category: "식당", lat: 33.215307, lng: 126.257902, distance: "약 360m" },
  { name: "별미양곱창", category: "식당", lat: 33.211794, lng: 126.255923, distance: "약 370m" },
  { name: "힛뜨수산 제주", category: "식당", lat: 33.212499, lng: 126.254651, distance: "약 480m" },
  { name: "방어축제의거리", category: "관광", lat: 33.219806, lng: 126.251324, distance: "약 1.1km" },
  { name: "시계탑상가거리", category: "관광", lat: 33.221784, lng: 126.253696, distance: "약 1.2km" },
  { name: "농남못", category: "관광", lat: 33.219466, lng: 126.269872, distance: "약 1.2km" },
  { name: "이기풍선교기념관", category: "관광", lat: 33.221395, lng: 126.249723, distance: "약 1.4km" },
  { name: "대정현역사자료전시관", category: "관광", lat: 33.225143, lng: 126.256284, distance: "약 1.4km" },
];

declare global {
  interface Window { L?: any }
}

let leafletPromise: Promise<any> | null = null;
// Leaflet(오픈소스 지도 엔진)을 CDN에서 한 번만 불러온다. 이 저장소의 index.html과 동일한 방식.
function ensureLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("leaflet load failed"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

type JoinItem = {
  id: number;
  title: string;
  keyword: string;
  location: string;
  icon: string;
  date: string;
  time: string;
  max: number;
  people: number;
  status: JoinStatus;
  host: string;
  description: string;
  isOwner: boolean;
  joined: boolean;
  participantNames?: string[];
  isSynthetic?: boolean;
};

const syntheticJoins: JoinItem[] = syntheticSeed.joinRequests.map((item, index) => ({
  id: 1_000_000 + index,
  title: item.title,
  description: item.description,
  keyword: item.category,
  location: item.location,
  icon: item.category === "식사" ? "🍜" : item.category === "운동" ? "🏃" : item.category === "사진" ? "📷" : item.category === "카페" ? "☕" : "🗺️",
  date: item.scheduledDate,
  time: item.scheduledTime,
  max: item.maxParticipants,
  people: item.currentParticipants,
  status: item.status as JoinStatus,
  host: item.hostNickname,
  isOwner: false,
  joined: false,
  isSynthetic: true,
}));

const weeklyBucketJoins = [
  { title: "돌고래투어", dayLabel: "매주 월요일", weekday: 1, time: "19:00", icon: "🐬", tone: "ocean", description: "제주 바다에서 돌고래를 만나러 가는 버킷의 정기 투어예요.", formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdw53QgggPVqgUDMI1cq-2ZXnlVLXdCibGLpA4AGOu53lTrrg/viewform" },
  { title: "별밤투어", dayLabel: "매주 수요일", weekday: 3, time: "20:00", icon: "🌌", tone: "night", description: "제주의 밤하늘과 별빛을 함께 즐기는 버킷의 정기 투어예요.", formUrl: "https://docs.google.com/forms/d/e/1FAIpQLScTLM4AOIM5iwPmHrKyg3r3BpyzeQshT3aF3RpyvGE68m9qRg/viewform" },
  { title: "바베큐 파티", dayLabel: "매주 금요일", weekday: 5, time: "18:00", icon: "🍖", tone: "bbq", description: "여행자들과 맛있는 음식과 이야기를 나누는 금요일 저녁 파티예요.", formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeBPjRarK36D25jx0x5Xm576R6vqkBVgszcduLZv1ZWnQDHqQ/viewform" },
];

function nextWeeklyLabel(weekday: number, time: string, now: number) {
  const koreaNow = new Date(now + 9 * 60 * 60 * 1000);
  const [hour, minute] = time.split(":").map(Number);
  let daysAhead = (weekday - koreaNow.getUTCDay() + 7) % 7;
  const currentMinutes = koreaNow.getUTCHours() * 60 + koreaNow.getUTCMinutes();
  if (daysAhead === 0 && currentMinutes >= hour * 60 + minute) daysAhead = 7;
  const targetUtc = Date.UTC(koreaNow.getUTCFullYear(), koreaNow.getUTCMonth(), koreaNow.getUTCDate() + daysAhead, hour - 9, minute);
  return new Date(targetUtc).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
}

export default function ClientHome({ user }: { user: ChatGPTUser | null }) {
  const [tab, setTab] = useState<Tab>("home");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nicknameDraft, setNicknameDraft] = useState(user?.displayName ?? "");
  const [editingNickname, setEditingNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [joins, setJoins] = useState<JoinItem[]>(syntheticJoins);
  const [creatingJoin, setCreatingJoin] = useState(false);
  const [savingJoin, setSavingJoin] = useState(false);
  const [joinDraft, setJoinDraft] = useState({
    title: "",
    description: "",
    location: "",
    date: "",
    time: "",
    max: "4",
    keyword: "여행",
  });
  const [keyword, setKeyword] = useState("전체");
  const [joinSort, setJoinSort] = useState<"newest" | "oldest">("newest");
  const [joinView, setJoinView] = useState<"upcoming" | "closed" | "past">("upcoming");
  const [placeCat, setPlaceCat] = useState("전체");
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [toast, setToast] = useState("");
  const [askInput, setAskInput] = useState("");
  const [locale, setLocale] = useState<GuesthouseLocale>("ko");
  const [askMessages, setAskMessages] = useState<AskMessage[]>([
    { role: "assistant", text: localeCopy.ko.greeting },
  ]);
  const [statusNow, setStatusNow] = useState(() => Date.now());
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  const [askLoading, setAskLoading] = useState(false);
  const askBucket = async (askQuestion: string) => {
    if (!askQuestion.trim() || askLoading) return;
    const userMessage: AskMessage = { role: "user", text: askQuestion };
    setAskMessages((prev) => [...prev, userMessage]);
    setAskInput("");
    setAskLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/v1/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: askQuestion }),
      });

      if (!response.ok) {
        throw new Error("API 요청 실패");
      }
      
      const result = await response.json();
      setAskMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.answer, sources: result.sources?.map((s: any) => s.metadata?.source || "팀 자료") },
      ]);
    } catch (error) {
      setAskMessages((prev) => [
        ...prev,
        { role: "assistant", text: "앗, 지금은 자료를 찾아보기가 어려워요. 조금 뒤에 다시 물어봐주세요!" },
      ]);
    } finally {
      setAskLoading(false);
    }
  };
  const markersLayerRef = useRef<any>(null);
  const displayJoins = useMemo(
    () => joins.map((item) => withEffectiveStatus(item, statusNow)),
    [joins, statusNow],
  );
  const keywords = ["전체", ...Array.from(new Set(displayJoins.map((item) => item.keyword)))];
  const visible = useMemo(
    () => displayJoins.filter((item) => keyword === "전체" || item.keyword === keyword),
    [displayJoins, keyword],
  );
  // 지난 일정과 예정 일정을 나누고, 선택한 정렬(최신순/오래된순)을 적용한다.
  const joinBuckets = useMemo(() => {
    const withTs = visible.map((item) => ({
      item,
      ts: new Date(`${item.date}T${item.time}:00+09:00`).getTime(),
    }));
    const cmp = (a: { ts: number }, b: { ts: number }) => (joinSort === "newest" ? b.ts - a.ts : a.ts - b.ts);
    const upcoming = withTs
      .filter((x) => (Number.isNaN(x.ts) || x.ts >= statusNow) && x.item.status === "모집중")
      .sort(cmp)
      .map((x) => x.item);
    const closed = withTs
      .filter((x) => (Number.isNaN(x.ts) || x.ts >= statusNow) && x.item.status === "모집완료")
      .sort(cmp)
      .map((x) => x.item);
    const past = withTs
      .filter((x) => !Number.isNaN(x.ts) && x.ts < statusNow)
      .sort((a, b) => b.ts - a.ts) // 지난 일정은 항상 가장 최근에 지난 것부터
      .map((x) => x.item);
    return { upcoming, closed, past };
  }, [visible, joinSort, statusNow]);
  const homeUpcoming = useMemo(() => displayJoins
    .filter((item) => {
      const ts = new Date(`${item.date}T${item.time}:00+09:00`).getTime();
      return (Number.isNaN(ts) || ts >= statusNow) && item.status === "모집중";
    })
    .sort((a, b) => new Date(`${a.date}T${a.time}:00+09:00`).getTime() - new Date(`${b.date}T${b.time}:00+09:00`).getTime()), [displayJoins, statusNow]);
  const faqSuggestions = useMemo(
    () => ["wifi", "facilities", "lost-found", "first-aid"]
      .map((id) => guesthouseFaq.find((item) => item.id === id)!.question[locale]),
    [locale],
  );

  useEffect(() => {
    fetch("/api/joins")
      .then((response) => response.json())
      .then((result: { joins?: JoinItem[] }) => setJoins([...(result.joins ?? []), ...syntheticJoins]))
      .catch(() => setToast("Join 목록을 불러오지 못했어요."));

    const timer = window.setInterval(() => setStatusNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("bucket-locale") as GuesthouseLocale | null;
    const browser = navigator.languages?.[0] ?? navigator.language ?? "ko";
    const detected: GuesthouseLocale = browser.toLowerCase().startsWith("ja")
      ? "ja"
      : browser.toLowerCase().startsWith("zh")
        ? "zh"
        : browser.toLowerCase().startsWith("en")
          ? "en"
          : "ko";
    const next = saved && ["ko", "en", "ja", "zh"].includes(saved) ? saved : detected;
    setLocale(next);
    setAskMessages([{ role: "assistant", text: localeCopy[next].greeting }]);
  }, []);

  // "근처 발견" 탭이 열릴 때 Leaflet 지도를 만들고 정보 제공 경계(반경 2km 울타리)를 그린다.
  const renderPlaceMarkers = (L: any) => {
    const layer = markersLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    mapPlaces
      .filter((place) => placeCat === "전체" || place.category === placeCat)
      .forEach((place) => {
        const emoji = CATEGORY_EMOJI[place.category] ?? "📍";
        const icon = L.divIcon({
          className: "place-emoji-pin",
          html: `<span>${emoji}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        L.marker([place.lat, place.lng], { icon })
          .addTo(layer)
          .bindTooltip(`${emoji} ${place.name} · ${place.category} · ${place.distance}`, { direction: "top" })
          .on("click", () => setSelectedPlace(place));
      });
  };

  useEffect(() => {
    if (tab !== "place") return;
    let cancelled = false;
    ensureLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstanceRef.current) return;
        const map = L.map(mapRef.current, { scrollWheelZoom: false, zoomControl: false });
        mapInstanceRef.current = map;
        map.setView(BUCKET_ORIGIN, 14); // 벡터 레이어·컨트롤 투영을 위해 초기 뷰 먼저 설정
        L.control.zoom({ position: "bottomleft" }).addTo(map);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);
        // 정보가 적용된 범위를 나타내는 점선 울타리(반경 2km)
        const fence = L.circle(BUCKET_ORIGIN, {
          radius: COVERAGE_RADIUS_M,
          color: "#e8892b",
          weight: 2,
          dashArray: "6 7",
          fillColor: "#f6b24a",
          fillOpacity: 0.12,
        }).addTo(map);
        fence.bindTooltip("정보 제공 경계 · 반경 2km", { direction: "top", sticky: true });
        map.fitBounds(fence.getBounds(), { padding: [16, 16] });
        const originIcon = L.divIcon({
          className: "bucket-origin-pin",
          html: "<span>귤</span>",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker(BUCKET_ORIGIN, { icon: originIcon, keyboard: false })
          .addTo(map)
          .bindTooltip("버킷제주", { direction: "top" });
        L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
        const markers = L.layerGroup().addTo(map);
        markersLayerRef.current = markers;
        renderPlaceMarkers(L);
        map.fitBounds(fence.getBounds(), { padding: [16, 16] });
        window.setTimeout(() => map.invalidateSize(), 80);
      })
      .catch(() => setToast("지도를 불러오지 못했어요."));
    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersLayerRef.current = null;
    };
  }, [tab]);

  // 카테고리 필터가 바뀌면 마커만 다시 그린다.
  useEffect(() => {
    if (tab !== "place") return;
    const L = typeof window !== "undefined" ? window.L : undefined;
    if (L && mapInstanceRef.current && markersLayerRef.current) renderPlaceMarkers(L);
  }, [placeCat, tab]);

  const changeLocale = (next: GuesthouseLocale) => {
    setLocale(next);
    window.localStorage.setItem("bucket-locale", next);
    setAskMessages([{ role: "assistant", text: localeCopy[next].greeting }]);
  };

  const move = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveNickname = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingNickname(true);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: nicknameDraft }),
    });
    const result = (await response.json()) as {
      displayName?: string;
      error?: string;
    };

    setSavingNickname(false);
    if (!response.ok || !result.displayName) {
      setToast(result.error ?? "닉네임을 저장하지 못했어요.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }

    setDisplayName(result.displayName);
    setNicknameDraft(result.displayName);
    setEditingNickname(false);
    setToast("닉네임을 바꿨어요.");
    window.setTimeout(() => setToast(""), 1800);
  };

  const saveJoin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      window.location.href = "/signin-with-chatgpt?return_to=/";
      return;
    }

    setSa…1197 tokens truncated…className="user-chip" onClick={() => move("profile")}><span>👤</span><b>{displayName || "로그인"}</b></button>
        </div>
      </header>

      {tab === "home" && <>
        <section className="hero shell">
          <div className="hero-copy">
            <span className="eyebrow">BUCKET GUESTHOUSE · JEJU</span>
            <h1>제주에서<br/><em>함께할 순간</em>을 담아요</h1>
            <p>혼자 온 여행자도 금세 친구가 되는 곳.<br/>버킷제주 반경 2km의 장소와 투숙객 Join을 만나보세요.</p>
            <div className="hero-actions"><button className="primary" onClick={() => move("join")}>Join 시작하기 →</button><button className="text-btn" onClick={() => move("place")}>근처 둘러보기</button></div>
          </div>
          <div className="hero-art"><span className="sun"/><span className="cloud c1"/><span className="cloud c2"/><span className="mountain"/><span className="sea-line"/><span className="harubang"><i/><b>•‿•</b></span><span className="orange-tree">●</span><div className="art-sticker">오늘의 제주<br/><strong>바람 좋음</strong></div></div>
        </section>
        <section className="join-preview"><div className="shell"><div className="section-heading light"><div><span className="mini-label">JOIN · READY</span><h2>{homeUpcoming.length > 0 ? "지금 참여할 수 있는 Join" : "새로운 Join을 기다리고 있어요"}</h2><p>{homeUpcoming.length > 0 ? `예정된 ${Math.min(homeUpcoming.length, 3)}개의 모임을 확인해 보세요.` : "지난 일정은 Join 페이지에서 따로 확인할 수 있어요."}</p></div><button onClick={() => move("join")}>{homeUpcoming.length > 0 ? "전체 Join 보기 →" : "Join 확인하기 →"}</button></div>{homeUpcoming.length > 0 && <div className="join-grid">{homeUpcoming.slice(0, 3).map((item) => <JoinCard key={item.id} item={item} onJoin={() => toggleJoin(item)} />)}</div>}</div></section>
      </>}

      {tab === "place" && <section className="subpage shell">
        <span className="eyebrow">AROUND BUCKET · 2KM</span><h1>버킷제주 근처를 발견해요</h1><p className="lead">버킷제주의 고정 위치를 중심으로 반경 2km 안의 장소만 안내합니다. 지도의 <b>점선 울타리</b>가 정보가 적용된 범위예요.</p>
        <div className="place-cat-row"><button className={placeCat === "전체" ? "active" : ""} onClick={() => setPlaceCat("전체")}>전체</button>{PLACE_CATEGORIES.map((c) => <button key={c.key} className={placeCat === c.key ? "active" : ""} onClick={() => setPlaceCat(c.key)}>{c.emoji} {c.key}</button>)}</div>
        <div className="map-panel"><div className="real-map"><div ref={mapRef} className="real-map-canvas" role="img" aria-label="버킷제주 중심 반경 2km 정보 제공 경계 지도"/><div className="map-origin"><span className="brand-mark">귤</span><span><b>버킷제주</b><small>반경 2km 안내 경계</small></span></div><div className="map-fence-legend"><span className="fence-swatch" aria-hidden="true"/><span>정보 제공 경계 · 반경 2km</span></div></div><div className="result-list"><div className="result-head"><b>{placeCat === "전체" ? "가까운 곳" : `${CATEGORY_EMOJI[placeCat] ?? ""} ${placeCat}`}</b><span>{mapPlaces.filter((p) => placeCat === "전체" || p.category === placeCat).length}곳 · 2km 이내</span></div>{mapPlaces.filter((p) => placeCat === "전체" || p.category === placeCat).map((place) => <button key={place.name} onClick={() => setSelectedPlace(place)} aria-label={`${place.name} 상세 정보 보기`}><span className="place-icon mint">{CATEGORY_EMOJI[place.category] ?? "📍"}</span><span><small>{place.category} · {place.distance}</small><b>{place.name}</b><p>눌러서 장소 정보와 길찾기 보기</p></span><i aria-hidden="true">›</i></button>)}</div></div>
      </section>}

      {tab === "join" && <section className="subpage shell">
        <div className="join-title-row"><div><span className="eyebrow">JOIN</span><h1>{displayJoins.length}개의 제주 Join</h1></div><button className="primary" onClick={() => user ? setCreatingJoin(true) : window.location.assign("/signin-with-chatgpt?return_to=/")}>Join 만들기 <span>＋</span></button></div>
        <section className="weekly-joins" aria-labelledby="weekly-joins-title"><div className="weekly-joins-head"><div><span className="mini-label">BUCKET WEEKLY JOIN</span><h2 id="weekly-joins-title">매주 만나는 버킷 정기 Join</h2><p>요일마다 열리는 버킷의 대표 프로그램이에요. 원하는 일정을 골라 미리 신청해 주세요.</p></div><span className="always-open">상시 신청</span></div><div className="weekly-join-grid">{weeklyBucketJoins.map((item) => <article className={`weekly-join-card ${item.tone}`} key={item.title}><div className="weekly-join-visual"><span>{item.icon}</span><i>정기 Join</i></div><div className="weekly-join-body"><span className="next-date">다음 일정 · {nextWeeklyLabel(item.weekday, item.time, statusNow)}</span><h3>{item.title}</h3><b>{item.dayLabel} · {item.time}</b><p>{item.description}</p><a href={item.formUrl} target="_blank" rel="noreferrer" aria-label={`${item.title} 신청서 열기`}>신청하기 →</a></div></article>)}</div></section>
        <div className="synthetic-notice"><b>테스트용 합성 데이터</b><span>가상 투숙객 30명 · 무작위 Join 60건 · 2026.08.05–08.19</span><p>실제 인물, 예약 또는 모임이 아닙니다. 테스트 종료 후 일괄 삭제할 예정입니다.</p></div>
        <details className="synthetic-guests"><summary>가상 테스트 계정 30명 보기</summary><div>{syntheticSeed.guests.map((guest) => <span key={guest.id}><b>👤 {guest.nickname}</b><small>{guest.syntheticName} · {guest.gender} · {guest.nationality}</small><i>{guest.testAccountId} · {guest.checkInDate.slice(5)}–{guest.checkOutDate.slice(5)}</i></span>)}</div></details>
        <div className="distribution-strip" aria-label="일자별 합성 Join 개수">{Object.entries(syntheticSeed._meta.joinDistribution).map(([date, count]) => <span key={date}><small>{date.slice(5)}</small><i style={{height: `${8 + Number(count) * 4}px`}}/><b>{count}건</b></span>)}</div>
        <div className="join-view-tabs" role="tablist" aria-label="Join 일정 구분"><button role="tab" aria-selected={joinView === "upcoming"} className={joinView === "upcoming" ? "active" : ""} onClick={() => setJoinView("upcoming")}>신청 가능한 Join <span>{joinBuckets.upcoming.length}</span></button><button role="tab" aria-selected={joinView === "closed"} className={joinView === "closed" ? "active" : ""} onClick={() => setJoinView("closed")}>모집 완료 <span>{joinBuckets.closed.length}</span></button><button role="tab" aria-selected={joinView === "past"} className={joinView === "past" ? "active" : ""} onClick={() => setJoinView("past")}>지난 Join <span>{joinBuckets.past.length}</span></button></div>
        <div className="join-toolbar">
          <div className="join-filters">{keywords.map((item) => <button key={item} className={keyword === item ? "selected" : ""} onClick={() => setKeyword(item)}>{item}</button>)}</div>
          <label className="join-sort">정렬<select value={joinSort} onChange={(event) => setJoinSort(event.target.value as "newest" | "oldest")}><option value="newest">최신순</option><option value="oldest">오래된순</option></select></label>
        </div>
        {joinView === "upcoming"
          ? joinBuckets.upcoming.length > 0
            ? <div className="join-page-grid">{joinBuckets.upcoming.map((item) => <JoinCard key={item.id} item={item} onJoin={() => toggleJoin(item)}/>)}</div>
            : <div className="keyword-panel"><span className="mini-label">OPEN JOIN</span><h2>지금 신청 가능한 Join이 없어요</h2><p>정기 Join에 신청하거나 모집 완료 탭에서 예정된 일정을 확인해 보세요.</p></div>
          : joinView === "closed"
            ? joinBuckets.closed.length > 0
              ? <div className="join-page-grid">{joinBuckets.closed.map((item) => <JoinCard key={item.id} item={item} onJoin={() => toggleJoin(item)}/>)}</div>
              : <div className="keyword-panel"><span className="mini-label">CLOSED JOIN</span><h2>모집 완료된 Join이 없어요</h2><p>정원이 찬 예정 일정이 생기면 이곳에 따로 보여드려요.</p></div>
          : joinBuckets.past.length > 0
            ? <div className="join-page-grid past-grid">{joinBuckets.past.map((item) => <JoinCard key={item.id} item={item} onJoin={() => toggleJoin(item)}/>)}</div>
            : <div className="keyword-panel"><span className="mini-label">PAST JOIN</span><h2>지난 Join이 없어요</h2><p>종료된 일정이 생기면 이곳에 따로 모아 보여드려요.</p></div>}
      </section>}

      {tab === "ask" && <section className="subpage shell ask-page">
        <span className="eyebrow">BUCKET AI · TEAM KNOWLEDGE</span>
        <h1>버킷에게 무엇이든 물어보세요</h1>
        <p className="lead">팀 저장소의 버킷제주 주변 장소 자료를 검색해 가까운 맛집과 편의시설, 산책 장소를 근거와 함께 안내합니다.</p>
        <div className="ask-layout">
          <div className="ask-chat">
            <div className="ask-thread" aria-live="polite">{askMessages.map((message, index) => message.role === "assistant"
              ? <div className="assistant-message" key={index}><span className="ask-bot">귤</span><div><b>버킷 AI</b><p>{message.text}</p>{message.sources && <div className="answer-sources">{message.sources.map((source) => <span key={source}>근거 · {source}</span>)}</div>}</div></div>
              : <div className="user-message" key={index}>{message.text}</div>)}</div>
            <div className="ask-suggestions"><span>{localeCopy[locale].suggestions}</span><div>{faqSuggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => askBucket(suggestion)}>{suggestion}</button>)}</div></div>
            <form className="ask-composer" onSubmit={(event) => { event.preventDefault(); askBucket(askInput); }}><label htmlFor="bucket-question">{localeCopy[locale].suggestions}</label><div><input id="bucket-question" value={askInput} onChange={(event) => setAskInput(event.target.value)} placeholder={localeCopy[locale].placeholder} /><button type="submit" disabled={!askInput.trim()}>{localeCopy[locale].send}</button></div><small>숙소 공식 이용 안내와 팀 저장소의 장소 자료만 사용합니다.</small></form>
          </div>
          <aside className="knowledge-status">
            <span className="mini-label">KNOWLEDGE STATUS</span><h2>팀 자료 연결 완료</h2><p>음식점 12곳, 관광·문화 6곳, 편의시설 3곳의 정리된 자료를 사용합니다.</p>
            <div className="source-owner"><span>21</span><div><b>주변 장소 자료</b><small>이름·분류·설명·거리 기준</small></div><i>사용 가능</i></div>
            <div className="source-owner"><span>✓</span><div><b>근거 표시</b><small>답변마다 사용한 장소 공개</small></div><i>적용됨</i></div>
            <div className="rag-flow"><b>답변 원칙</b><ol><li>질문 의도와 장소 분류 확인</li><li>가까운 후보 우선 안내</li><li>자료에 없으면 추측하지 않기</li></ol></div>
          </aside>
        </div>
      </section>}

      {tab === "profile" && <section className="subpage shell profile-page">
        <div className="profile-head"><div className="avatar">👤</div><div><span className="eyebrow">ACCOUNT</span><h1>{displayName || "내 계정 만들기"}</h1><p>{user ? `${user.email} 계정으로 연결되었습니다.` : "로그인 후 서비스 내부 사용자 계정이 자동으로 생성됩니다."}</p><div className="stats"><span><b>0</b> Join</span><span><b>0</b> 신청</span><span><b>0</b> 참여 기록</span></div></div>{user && <button type="button" onClick={() => setEditingNickname(true)}>닉네임 변경</button>}</div>
        <div className="keyword-panel" style={{marginTop: 24}}><div className="panel-title"><div><span className="mini-label">ACCOUNT</span><h2>{user ? "계정 연결 완료" : "계정으로 시작하기"}</h2></div><span className="test-badge">{user ? "로그인됨" : "로그인 필요"}</span></div><p>서비스는 비밀번호를 저장하지 않습니다. 인증 후 내부 사용자 ID를 만들고 Join 생성·신청·취소·참여 기록을 계정별로 관리합니다.</p>{user ? <a className="primary" href="/signout-with-chatgpt?return_to=/">로그아웃</a> : <a className="primary" href="/signin-with-chatgpt?return_to=/">로그인하고 계정 만들기</a>}</div>
      </section>}

      <nav className="mobile-nav"><button onClick={()=>move("home")}><span>🏠</span>홈</button><button onClick={()=>move("place")}><span>🗺️</span>발견</button><button className="join-fab" onClick={()=>move("join")}><span>＋</span>Join</button><button onClick={()=>move("ask")}><span>💬</span>AI 질문</button><button onClick={()=>move("profile")}><span>🍊</span>버킷</button></nav>
      {selectedPlace && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedPlace(null)}><section className="place-detail-modal" role="dialog" aria-modal="true" aria-labelledby="place-detail-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="닫기" onClick={() => setSelectedPlace(null)}>×</button><span className="place-detail-emoji" aria-hidden="true">{CATEGORY_EMOJI[selectedPlace.category] ?? "📍"}</span><div className="place-detail-heading"><span>{selectedPlace.category} · 버킷제주에서 {selectedPlace.distance}</span><h2 id="place-detail-title">{selectedPlace.name}</h2></div><p>{PLACE_DETAIL_COPY[selectedPlace.category] ?? "버킷제주에서 가볍게 다녀오기 좋은 장소예요."}</p><dl><div><dt>거리</dt><dd>{selectedPlace.distance}</dd></div><div><dt>분류</dt><dd>{CATEGORY_EMOJI[selectedPlace.category] ?? "📍"} {selectedPlace.category}</dd></div><div><dt>위치</dt><dd>{selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}</dd></div></dl><div className="place-detail-actions"><a href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lng}`} target="_blank" rel="noreferrer">지도에서 보기</a><a className="primary" href={`https://www.google.com/maps/dir/?api=1&origin=${BUCKET_ORIGIN[0]},${BUCKET_ORIGIN[1]}&destination=${selectedPlace.lat},${selectedPlace.lng}&travelmode=walking`} target="_blank" rel="noreferrer">도보 길찾기 →</a></div><small className="place-detail-note">영업시간·운항·진료 정보는 방문 전에 지도 서비스에서 다시 확인해 주세요.</small></section></div>}
      {creatingJoin && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreatingJoin(false)}><section className="join-modal" role="dialog" aria-modal="true" aria-labelledby="join-create-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="닫기" onClick={() => setCreatingJoin(false)}>×</button><span className="mini-label">NEW JOIN</span><h2 id="join-create-title">새로운 Join 만들기</h2><p>함께하고 싶은 일정과 모집 내용을 알려주세요.</p><form onSubmit={saveJoin}><label>제목<input required maxLength={40} value={joinDraft.title} onChange={(event) => setJoinDraft({...joinDraft, title:event.target.value})} placeholder="예: 함께 오름 일몰 보러 가요" /></label><label>소개<textarea required maxLength={300} rows={4} value={joinDraft.description} onChange={(event) => setJoinDraft({...joinDraft, description:event.target.value})} placeholder="어떤 시간을 함께 보내고 싶은지 적어주세요" /></label><div className="form-grid"><label>장소<input required maxLength={60} value={joinDraft.location} onChange={(event) => setJoinDraft({...joinDraft, location:event.target.value})} placeholder="만나는 장소" /></label><label>주제<select value={joinDraft.keyword} onChange={(event) => setJoinDraft({...joinDraft, keyword:event.target.value})}><option>여행</option><option>맛집</option><option>산책</option><option>액티비티</option><option>기타</option></select></label><label>날짜<input required type="date" value={joinDraft.date} onChange={(event) => setJoinDraft({...joinDraft, date:event.target.value})} /></label><label>시간<input required type="time" value={joinDraft.time} onChange={(event) => setJoinDraft({...joinDraft, time:event.target.value})} /></label><label>모집 인원<input required type="number" min={2} max={20} value={joinDraft.max} onChange={(event) => setJoinDraft({...joinDraft, max:event.target.value})} /></label></div><button className="primary submit-join" type="submit" disabled={savingJoin}>{savingJoin ? "등록 중…" : "Join 등록하기"}</button></form></section></div>}
      {editingNickname && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingNickname(false)}><section className="nickname-modal" role="dialog" aria-modal="true" aria-labelledby="nickname-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="닫기" onClick={() => setEditingNickname(false)}>×</button><span className="mini-label">MY PROFILE</span><h2 id="nickname-title">닉네임 바꾸기</h2><p>Join과 프로필에 표시할 이름을 정해 주세요.</p><form onSubmit={saveNickname}><label htmlFor="nickname">닉네임</label><input id="nickname" autoFocus minLength={2} maxLength={20} value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} placeholder="2~20자로 입력" /><small>{nicknameDraft.trim().length}/20</small><button className="primary" type="submit" disabled={savingNickname || nicknameDraft.trim().length < 2}>{savingNickname ? "저장 중…" : "닉네임 저장"}</button></form></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      <footer><div className="shell"><span className="brand-mark">귤</span><p><b>BUCKET GUESTHOUSE · JEJU</b><small>오늘의 인연이 내일의 추억으로.</small></p><i>v1.6.0 · 지도 발견 · Join 정렬</i></div></footer>
    </main>
  );
}

function JoinCard({ item, onJoin }: { item: JoinItem; onJoin: () => void }) {
  const buttonLabel = item.isSynthetic ? "테스트 Join · 참여 불가" : item.isOwner ? "내가 만든 모임" : item.joined ? "참여 완료 ✓" : item.status === "모집중" ? "함께하기" : item.status;
  return <article className={`join-card ${item.status !== "모집중" ? "join-card-complete" : ""} ${item.isSynthetic ? "join-card-synthetic" : ""}`}><div className="join-visual green"><span>{item.icon}</span><i>{item.status}</i>{item.isSynthetic && <em>합성 데이터</em>}</div><div className="join-body"><div className="tags"><span>#{item.keyword}</span><span>#{item.date.slice(5)}</span></div><h3>{item.title}</h3><p className="join-description">{item.description}</p><p>🕒 {item.date} {item.time}</p><p>📍 {item.location}</p><p>👥 {item.people}/{item.max}명 · by {item.host}</p>{item.isOwner && <div className="participant-list"><b>참여자</b>{item.participantNames?.length ? <ul>{item.participantNames.map((name) => <li key={name}>👤 {name}</li>)}</ul> : <p>아직 참여자가 없어요.</p>}</div>}<button className={item.joined ? "joined" : ""} disabled={item.status !== "모집중" || item.isOwner || item.isSynthetic} onClick={onJoin}>{buttonLabel}</button></div></article>;
}

function withEffectiveStatus(item: JoinItem, now: number): JoinItem {
  if (item.status !== "모집중") return item;

  const scheduledAt = new Date(`${item.date}T${item.time}:00+09:00`).getTime();
  return Number.isNaN(scheduledAt) || scheduledAt > now
    ? item
    : { ...item, status: "일정완료" };
}

