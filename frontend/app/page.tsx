"use client";

import { useMemo, useState } from "react";

type Tab = "home" | "place" | "join" | "profile";
type JoinStatus = "모집중" | "모집완료" | "일정완료";

const guests = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  nickname: ["귤빛파도", "오름산책", "모슬포고래", "제주바람", "하모노을", "돌담여행"][index % 6] + String(index + 1).padStart(2, "0"),
}));

const themes = [
  ["아침 하모해변 산책", "산책", "하모해변", "🌊"],
  ["대정 로컬 맛집 탐방", "식사", "대정읍", "🍲"],
  ["송악산 가벼운 트레킹", "운동", "송악산", "🥾"],
  ["모슬포항 노을 사진", "사진", "모슬포항", "📷"],
  ["제주 감성 카페 같이 가요", "카페", "하모리", "☕"],
  ["자전거로 해안도로 달리기", "자전거", "대정 해안도로", "🚲"],
  ["저녁 보드게임 한 판", "친목", "버킷제주 로비", "🎲"],
  ["방어회 함께 먹어요", "식사", "모슬포항", "🐟"],
  ["가파도 당일치기", "여행", "운진항", "⛴️"],
  ["요가로 하루 시작", "요가", "하모해변", "🧘"],
] as const;

const joins = Array.from({ length: 60 }, (_, index) => {
  const day = Math.floor(index / 4) + 1;
  const theme = themes[index % themes.length];
  const max = 3 + (index % 6);
  const people = 1 + (index % Math.max(2, max - 1));
  const status: JoinStatus = index % 9 === 0 ? "모집완료" : "모집중";
  return {
    id: index + 1,
    title: theme[0],
    keyword: theme[1],
    location: theme[2],
    icon: theme[3],
    date: `2026-08-${String(day).padStart(2, "0")}`,
    time: ["08:00", "11:30", "16:00", "19:00"][index % 4],
    max,
    people: status === "모집완료" ? max : people,
    status,
    host: guests[index % guests.length].nickname,
    description: "버킷제주 투숙객끼리 부담 없이 만나 함께 즐겨요. 시간과 장소를 확인한 뒤 참여해 주세요.",
  };
});

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [keyword, setKeyword] = useState("전체");
  const [joined, setJoined] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const keywords = ["전체", ...Array.from(new Set(joins.map((item) => item.keyword)))];
  const visible = useMemo(
    () => joins.filter((item) => keyword === "전체" || item.keyword === keyword),
    [keyword],
  );

  const move = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleJoin = (id: number, status: JoinStatus) => {
    if (status !== "모집중") return;
    setJoined((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setToast(joined.includes(id) ? "참여를 취소했어요." : "조인에 참여했어요! 로비에서 만나요 🍊");
    window.setTimeout(() => setToast(""), 1800);
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => move("home")}>
          <span className="brand-mark">귤</span><span><b>BUCKET</b><small>JEJU GUESTHOUSE</small></span>
        </button>
        <nav className="desktop-nav">
          <button className={tab === "home" ? "active" : ""} onClick={() => move("home")}>홈</button>
          <button className={tab === "place" ? "active" : ""} onClick={() => move("place")}>근처 발견</button>
          <button className={tab === "join" ? "active" : ""} onClick={() => move("join")}>Join</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => move("profile")}>나의 버킷</button>
        </nav>
        <button className="user-chip" onClick={() => move("profile")}><span>🍊</span><b>귤빛파도01</b></button>
      </header>

      {tab === "home" && <>
        <section className="hero shell">
          <div className="hero-copy">
            <span className="eyebrow">BUCKET GUESTHOUSE · JEJU</span>
            <h1>제주에서<br/><em>함께할 순간</em>을 담아요</h1>
            <p>혼자 온 여행자도 금세 친구가 되는 곳.<br/>버킷제주 반경 2km의 장소와 투숙객 Join을 만나보세요.</p>
            <div className="hero-actions"><button className="primary" onClick={() => move("join")}>60개 Join 보기 →</button><button className="text-btn" onClick={() => move("place")}>근처 둘러보기</button></div>
          </div>
          <div className="hero-art"><span className="sun"/><span className="cloud c1"/><span className="cloud c2"/><span className="mountain"/><span className="sea-line"/><span className="harubang"><i/><b>•‿•</b></span><span className="orange-tree">●</span><div className="art-sticker">오늘의 제주<br/><strong>바람 좋음</strong></div></div>
        </section>
        <section className="join-preview"><div className="shell"><div className="section-heading light"><div><span className="mini-label">15 DAYS · 60 JOINS</span><h2>오늘, 같이 할래?</h2><p>합성 투숙객 30명이 만든 테스트 조인입니다.</p></div><button onClick={() => move("join")}>모두 보기 →</button></div><div className="join-grid">{joins.slice(0, 3).map((item) => <JoinCard key={item.id} item={item} joined={joined.includes(item.id)} onJoin={() => toggleJoin(item.id, item.status)}/>)}</div></div></section>
      </>}

      {tab === "place" && <section className="subpage shell">
        <span className="eyebrow">AROUND BUCKET · 2KM</span><h1>버킷제주 근처를 발견해요</h1><p className="lead">버킷제주의 고정 위치를 중심으로 반경 2km 안의 장소만 안내합니다.</p>
        <div className="map-panel"><div className="real-map"><iframe title="버킷제주 지도" src="https://www.openstreetmap.org/export/embed.html?bbox=126.2398%2C33.19245%2C126.2798%2C33.23245&layer=mapnik&marker=33.2124518%2C126.2598287" loading="lazy"/><div className="map-origin"><span className="brand-mark">귤</span><span><b>버킷제주</b><small>반경 2km 안내</small></span></div></div><div className="result-list"><div className="result-head"><b>가까운 곳</b><span>2km 이내</span></div>{[["하모해변","바다 · 도보 1분","🌊"],["대정쌍둥이식당","맛집 · 도보 10분","🍲"],["모슬포항","산책 · 도보 18분","⚓"],["운진항","여행 · 차량 6분","⛴️"]].map((place)=><button key={place[0]}><span className="place-icon mint">{place[2]}</span><span><small>{place[1]}</small><b>{place[0]}</b><p>버킷제주에서 가볍게 다녀오기 좋은 곳</p></span></button>)}</div></div>
      </section>}

      {tab === "join" && <section className="subpage shell">
        <div className="join-title-row"><div><span className="eyebrow">2026.08.01 — 08.15</span><h1>60개의 제주 Join</h1><p className="lead">가상 투숙객 30명과 만든 합성 시드 데이터입니다. 하루 4개 일정으로 구성했어요.</p></div></div>
        <div className="join-filters">{keywords.map((item) => <button key={item} className={keyword === item ? "selected" : ""} onClick={() => setKeyword(item)}>{item}</button>)}</div>
        <div className="join-page-grid">{visible.map((item) => <JoinCard key={item.id} item={item} joined={joined.includes(item.id)} onJoin={() => toggleJoin(item.id, item.status)}/>)}</div>
      </section>}

      {tab === "profile" && <section className="subpage shell profile-page">
        <div className="profile-head"><div className="avatar">🍊<span>5</span></div><div><span className="eyebrow">MY JEJU BUCKET</span><h1>귤빛파도01</h1><p>닉네임으로만 활동하는 인증 투숙객</p><div className="stats"><span><b>{joined.length}</b> Join</span><span><b>30</b> 투숙객</span><span><b>60</b> 일정</span></div></div></div>
        <div className="keyword-panel" style={{marginTop: 24}}><div className="panel-title"><div><span className="mini-label">MY TOP 5 KEYWORDS</span><h2>나의 제주 키워드</h2></div><span className="test-badge">TEST · 상위 5개</span></div><div className="bars">{[["산책",88],["식사",75],["사진",61],["카페",48],["여행",35]].map(([label,value], index)=><div className="bar-row" key={label}><span className="rank">{index+1}</span><b>{label}</b><div className="bar-track"><i style={{width:`${value}%`,background:["#ff775f","#57a895","#ffb43e","#70a7d4","#a98c72"][index]}}/></div><strong>{value}<small>점</small></strong></div>)}</div></div>
      </section>}

      <nav className="mobile-nav"><button onClick={()=>move("home")}><span>🏠</span>홈</button><button onClick={()=>move("place")}><span>🗺️</span>발견</button><button className="join-fab" onClick={()=>move("join")}><span>＋</span>Join</button><button onClick={()=>move("profile")}><span>🍊</span>버킷</button></nav>
      {toast && <div className="toast" role="status">{toast}</div>}
      <footer><div className="shell"><span className="brand-mark">귤</span><p><b>BUCKET GUESTHOUSE · JEJU</b><small>오늘의 인연이 내일의 추억으로.</small></p><i>v2 · Seed 60</i></div></footer>
    </main>
  );
}

function JoinCard({ item, joined, onJoin }: { item: (typeof joins)[number]; joined: boolean; onJoin: () => void }) {
  return <article className="join-card"><div className="join-visual green"><span>{item.icon}</span><i>{item.status}</i></div><div className="join-body"><div className="tags"><span>#{item.keyword}</span><span>#{item.date.slice(5)}</span></div><h3>{item.title}</h3><p className="join-description">{item.description}</p><p>🕒 {item.date} {item.time}</p><p>📍 {item.location}</p><p>👥 {item.people + (joined ? 1 : 0)}/{item.max}명 · by {item.host}</p><button className={joined ? "joined" : ""} disabled={item.status !== "모집중"} onClick={onJoin}>{joined ? "참여 완료 ✓" : item.status === "모집중" ? "함께하기" : item.status}</button></div></article>;
}
