"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatGPTUser } from "./chatgpt-auth";
type Tab = "home" | "place" | "join" | "ask" | "profile";
type JoinStatus = "모집중" | "모집완료" | "일정완료";

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
};

type AskResponse = {
  query: string;
  answer: string;
  sources: Array<{
    name: string;
    category_norm: string;
    distance_m: number;
    solo_friendly: boolean | null;
    document: string;
  }>;
};

export default function ClientHome({ user }: { user: ChatGPTUser | null }) {
  const [tab, setTab] = useState<Tab>("home");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nicknameDraft, setNicknameDraft] = useState(user?.displayName ?? "");
  const [editingNickname, setEditingNickname] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [joins, setJoins] = useState<JoinItem[]>([]);
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
  const [joined, setJoined] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);
  const keywords = ["전체", ...Array.from(new Set(joins.map((item) => item.keyword)))];
  const visible = useMemo(
    () => joins.filter((item) => keyword === "전체" || item.keyword === keyword),
    [joins, keyword],
  );

  useEffect(() => {
    fetch("/api/joins")
      .then((response) => response.json())
      .then((result: { joins?: JoinItem[] }) => setJoins(result.joins ?? []))
      .catch(() => setToast("Join 목록을 불러오지 못했어요."));
  }, []);

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

    setSavingJoin(true);
    const response = await fetch("/api/joins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(joinDraft),
    });
    const result = (await response.json()) as {
      join?: JoinItem;
      error?: string;
    };
    setSavingJoin(false);

    if (!response.ok || !result.join) {
      setToast(result.error ?? "Join을 등록하지 못했어요.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }

    setJoins((current) => [result.join!, ...current]);
    setJoinDraft({ title: "", description: "", location: "", date: "", time: "", max: "4", keyword: "여행" });
    setCreatingJoin(false);
    setToast("새 Join이 등록됐어요.");
    window.setTimeout(() => setToast(""), 1800);
  };

  const toggleJoin = (id: number, status: JoinStatus) => {
    if (status !== "모집중") return;
    setJoined((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setToast(joined.includes(id) ? "참여를 취소했어요." : "조인에 참여했어요! 로비에서 만나요 🍊");
    window.setTimeout(() => setToast(""), 1800);
  };

  const submitQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!askQuestion.trim()) return;

    setAskLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/v1/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: askQuestion }),
      });

      if (!response.ok) {
        setToast("질문을 처리하지 못했어요.");
        window.setTimeout(() => setToast(""), 2200);
        setAskLoading(false);
        return;
      }

      const result = (await response.json()) as AskResponse;
      setAskResponse(result);
      setAskQuestion("");
    } catch {
      setToast("질문을 처리하지 못했어요.");
      window.setTimeout(() => setToast(""), 2200);
    } finally {
      setAskLoading(false);
    }
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
          <button className={tab === "ask" ? "active" : ""} onClick={() => move("ask")}>AI 질문</button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => move("profile")}>나의 버킷</button>
        </nav>
        <button className="user-chip" onClick={() => move("profile")}><span>👤</span><b>{displayName || "로그인"}</b></button>
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
        <section className="join-preview"><div className="shell"><div className="section-heading light"><div><span className="mini-label">JOIN · READY</span><h2>{joins.length > 0 ? "지금 참여할 수 있는 Join" : "첫 Join을 기다리고 있어요"}</h2><p>{joins.length > 0 ? `최근 등록된 ${Math.min(joins.length, 3)}개의 모임을 확인해 보세요.` : "계정으로 로그인한 뒤 새로운 Join을 만들어보세요."}</p></div><button onClick={() => move("join")}>{joins.length > 0 ? "전체 Join 보기 →" : "Join 만들기 →"}</button></div>{joins.length > 0 && <div className="join-grid">{joins.slice(0, 3).map((item) => <JoinCard key={item.id} item={item} joined={joined.includes(item.id)} onJoin={() => toggleJoin(item.id, item.status)} />)}</div>}</div></section>
      </>}

      {tab === "place" && <section className="subpage shell">
        <span className="eyebrow">AROUND BUCKET · 2KM</span><h1>버킷제주 근처를 발견해요</h1><p className="lead">버킷제주의 고정 위치를 중심으로 반경 2km 안의 장소만 안내합니다.</p>
        <div className="map-panel"><div className="real-map"><iframe title="버킷제주 지도" src="https://www.openstreetmap.org/export/embed.html?bbox=126.2398%2C33.19245%2C126.2798%2C33.23245&layer=mapnik&marker=33.2124518%2C126.2598287" loading="lazy"/><div className="map-origin"><span className="brand-mark">귤</span><span><b>버킷제주</b><small>반경 2km 안내</small></span></div></div><div className="result-list"><div className="result-head"><b>가까운 곳</b><span>2km 이내</span></div>{[["하모해변","바다 · 도보 1분","🌊"],["대정쌍둥이식당","맛집 · 도보 10분","🍲"],["모슬포항","산책 · 도보 18분","⚓"],["운진항","여행 · 차량 6분","⛴️"]].map((place)=><button key={place[0]}><span className="place-icon mint">{place[2]}</span><span><small>{place[1]}</small><b>{place[0]}</b><p>버킷제주에서 가볍게 다녀오기 좋은 곳</p></span></button>)}</div></div>
      </section>}

      {tab === "join" && <section className="subpage shell">
        <div className="join-title-row"><div><span className="eyebrow">JOIN</span><h1>{joins.length}개의 제주 Join</h1></div><button className="primary" onClick={() => user ? setCreatingJoin(true) : window.location.assign("/signin-with-chatgpt?return_to=/")}>Join 만들기 <span>＋</span></button></div>
        <div className="join-filters">{keywords.map((item) => <button key={item} className={keyword === item ? "selected" : ""} onClick={() => setKeyword(item)}>{item}</button>)}</div>
        {visible.length === 0 ? <div className="keyword-panel"><span className="mini-label">EMPTY JOIN</span><h2>등록된 Join이 아직 없어요</h2><p>로그인한 사용자가 첫 Join을 만들면 이곳에 표시됩니다.</p></div> : <div className="join-page-grid">{visible.map((item) => <JoinCard key={item.id} item={item} joined={joined.includes(item.id)} onJoin={() => toggleJoin(item.id, item.status)}/>)}</div>}
      </section>}

      {tab === "ask" && <section className="subpage shell ask-page">
        <span className="eyebrow">BUCKET AI · BETA</span>
        <h1>버킷에게 무엇이든 물어보세요</h1>
        <p className="lead">제주 여행과 버킷 게스트하우스 자료를 바탕으로, 필요한 답을 근거와 함께 안내합니다.</p>
        <div className="ask-layout">
          <div className="ask-chat">
            {!askResponse && <div className="assistant-message"><span className="ask-bot">귤</span><div><b>안녕하세요, 버킷 AI예요.</b><p>제주 여행과 버킷제주 숙소 정보를 바탕으로 질문에 답변해드립니다. 근처 맛집, 관광지, 숙소 정보 등 무엇이든 물어보세요!</p></div></div>}
            {askResponse && <div className="assistant-message"><span className="ask-bot">귤</span><div><b>질문: {askResponse.query}</b><p>{askResponse.answer}</p>{askResponse.sources.length > 0 && <div style={{marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee", fontSize: "0.875em"}}>
              <b>참고 자료:</b>
              <ul style={{marginTop: 8}}>
                {askResponse.sources.map((source, idx) => (
                  <li key={idx} style={{marginBottom: 8}}>
                    <strong>{source.name || "[숙소 내부 정보]"}</strong> ({source.category_norm}) • {source.distance_m}m
                  </li>
                ))}
              </ul>
            </div>}</div></div>}
            {!askResponse && <div className="ask-suggestions"><span>예시 질문들</span><div><button onClick={() => setAskQuestion("체크인 전에 짐을 맡길 수 있나요?")}>체크인 전에 짐을 맡길 수 있나요?</button><button onClick={() => setAskQuestion("비 오는 날 가기 좋은 곳은 어디예요?")}>비 오는 날 가기 좋은 곳은 어디예요?</button><button onClick={() => setAskQuestion("근처 한식당 추천해주세요")}>근처 한식당 추천해주세요</button></div></div>}
            <div className="ask-composer"><label htmlFor="bucket-question">질문 입력</label><form onSubmit={submitQuestion}><div><input id="bucket-question" value={askQuestion} onChange={(e) => setAskQuestion(e.target.value)} placeholder="질문을 입력하세요" disabled={askLoading} /><button type="submit" disabled={askLoading || !askQuestion.trim()}>{askLoading ? "생각 중…" : "보내기"}</button></div></form><small>답변에는 참고한 자료의 출처가 함께 표시됩니다.</small></div>
          </div>
          <aside className="knowledge-status">
            <span className="mini-label">KNOWLEDGE STATUS</span><h2>자료 준비 완료</h2><p>POI 21개 + 숙소 정보 30개를 학습했습니다.</p>
            <div className="source-owner"><span>🗺</span><div><b>근처 장소 (POI)</b><small>21개 항목 학습 완료</small></div><i>✓ 준비됨</i></div>
            <div className="source-owner"><span>🏠</span><div><b>숙소 정보</b><small>게스트하우스 FAQ 30개</small></div><i>✓ 준비됨</i></div>
            <div className="rag-flow"><b>응답 프로세스</b><ol><li>질문 입력</li><li>관련 정보 검색</li><li>AI 답변 생성</li></ol></div>
          </aside>
        </div>
      </section>}

      {tab === "profile" && <section className="subpage shell profile-page">
        <div className="profile-head"><div className="avatar">👤</div><div><span className="eyebrow">ACCOUNT</span><h1>{displayName || "내 계정 만들기"}</h1><p>{user ? `${user.email} 계정으로 연결되었습니다.` : "로그인 후 서비스 내부 사용자 계정이 자동으로 생성됩니다."}</p><div className="stats"><span><b>0</b> Join</span><span><b>0</b> 신청</span><span><b>0</b> 참여 기록</span></div></div>{user && <button type="button" onClick={() => setEditingNickname(true)}>닉네임 변경</button>}</div>
        <div className="keyword-panel" style={{marginTop: 24}}><div className="panel-title"><div><span className="mini-label">ACCOUNT</span><h2>{user ? "계정 연결 완료" : "계정으로 시작하기"}</h2></div><span className="test-badge">{user ? "로그인됨" : "로그인 필요"}</span></div><p>서비스는 비밀번호를 저장하지 않습니다. 인증 후 내부 사용자 ID를 만들고 Join 생성·신청·취소·참여 기록을 계정별로 관리합니다.</p>{user ? <a className="primary" href="/signout-with-chatgpt?return_to=/">로그아웃</a> : <a className="primary" href="/signin-with-chatgpt?return_to=/">로그인하고 계정 만들기</a>}</div>
      </section>}

      <nav className="mobile-nav"><button onClick={()=>move("home")}><span>🏠</span>홈</button><button onClick={()=>move("place")}><span>🗺️</span>발견</button><button className="join-fab" onClick={()=>move("join")}><span>＋</span>Join</button><button onClick={()=>move("ask")}><span>💬</span>AI 질문</button><button onClick={()=>move("profile")}><span>🍊</span>버킷</button></nav>
      {creatingJoin && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCreatingJoin(false)}><section className="join-modal" role="dialog" aria-modal="true" aria-labelledby="join-create-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="닫기" onClick={() => setCreatingJoin(false)}>×</button><span className="mini-label">NEW JOIN</span><h2 id="join-create-title">새로운 Join 만들기</h2><p>함께하고 싶은 일정과 모집 내용을 알려주세요.</p><form onSubmit={saveJoin}><label>제목<input required maxLength={40} value={joinDraft.title} onChange={(event) => setJoinDraft({...joinDraft, title:event.target.value})} placeholder="예: 함께 오름 일몰 보러 가요" /></label><label>소개<textarea required maxLength={300} rows={4} value={joinDraft.description} onChange={(event) => setJoinDraft({...joinDraft, description:event.target.value})} placeholder="어떤 시간을 함께 보내고 싶은지 적어주세요" /></label><div className="form-grid"><label>장소<input required maxLength={60} value={joinDraft.location} onChange={(event) => setJoinDraft({...joinDraft, location:event.target.value})} placeholder="만나는 장소" /></label><label>주제<select value={joinDraft.keyword} onChange={(event) => setJoinDraft({...joinDraft, keyword:event.target.value})}><option>여행</option><option>맛집</option><option>산책</option><option>액티비티</option><option>기타</option></select></label><label>날짜<input required type="date" value={joinDraft.date} onChange={(event) => setJoinDraft({...joinDraft, date:event.target.value})} /></label><label>시간<input required type="time" value={joinDraft.time} onChange={(event) => setJoinDraft({...joinDraft, time:event.target.value})} /></label><label>모집 인원<input required type="number" min={2} max={20} value={joinDraft.max} onChange={(event) => setJoinDraft({...joinDraft, max:event.target.value})} /></label></div><button className="primary submit-join" type="submit" disabled={savingJoin}>{savingJoin ? "등록 중…" : "Join 등록하기"}</button></form></section></div>}
      {editingNickname && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditingNickname(false)}><section className="nickname-modal" role="dialog" aria-modal="true" aria-labelledby="nickname-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="닫기" onClick={() => setEditingNickname(false)}>×</button><span className="mini-label">MY PROFILE</span><h2 id="nickname-title">닉네임 바꾸기</h2><p>Join과 프로필에 표시할 이름을 정해 주세요.</p><form onSubmit={saveNickname}><label htmlFor="nickname">닉네임</label><input id="nickname" autoFocus minLength={2} maxLength={20} value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} placeholder="2~20자로 입력" /><small>{nicknameDraft.trim().length}/20</small><button className="primary" type="submit" disabled={savingNickname || nicknameDraft.trim().length < 2}>{savingNickname ? "저장 중…" : "닉네임 저장"}</button></form></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      <footer><div className="shell"><span className="brand-mark">귤</span><p><b>BUCKET GUESTHOUSE · JEJU</b><small>오늘의 인연이 내일의 추억으로.</small></p><i>v5 · Join Reset</i></div></footer>
    </main>
  );
}

function JoinCard({ item, joined, onJoin }: { item: JoinItem; joined: boolean; onJoin: () => void }) {
  return <article className="join-card"><div className="join-visual green"><span>{item.icon}</span><i>{item.status}</i></div><div className="join-body"><div className="tags"><span>#{item.keyword}</span><span>#{item.date.slice(5)}</span></div><h3>{item.title}</h3><p className="join-description">{item.description}</p><p>🕒 {item.date} {item.time}</p><p>📍 {item.location}</p><p>👥 {item.people + (joined ? 1 : 0)}/{item.max}명 · by {item.host}</p><button className={joined ? "joined" : ""} disabled={item.status !== "모집중"} onClick={onJoin}>{joined ? "참여 완료 ✓" : item.status === "모집중" ? "함께하기" : item.status}</button></div></article>;
}
