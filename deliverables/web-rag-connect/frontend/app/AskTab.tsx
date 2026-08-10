"use client";
import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string; sources?: string[] };
const SUGGESTIONS = ["가장 가까운 편의점은 어디야?", "혼밥할 수 있는 곳 추천해줘", "와이파이 비밀번호 알려줘"];

export default function AskTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = useRef<string>(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setValue("");
    setBusy(true);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, sessionId: sessionId.current }),
      });
      const data = (await r.json()) as { answer?: string; sources?: string[]; error?: string };
      setMessages((m) => [...m, { role: "assistant", text: data.answer || data.error || "답변을 가져오지 못했어요.", sources: data.sources }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "일시적으로 답변할 수 없어요. 잠시 후 다시 시도해 주세요." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="subpage shell ask-page">
      <span className="eyebrow">BUCKET AI · RAG</span>
      <h1>무엇이든 물어보세요</h1>
      <p className="lead">버킷제주 주변 정보와 숙소 안내를, 검색 근거와 함께 답해드려요.</p>
      <div className="ask-layout">
        <div className="ask-chat">
          <div className="assistant-message"><span className="ask-bot">귤</span><div><b>안녕하세요, 버킷 AI예요.</b><p>근처 장소·숙소 이용 안내를 물어보세요. 아는 것만, 근거와 함께 답해드릴게요.</p></div></div>
          {messages.map((m, i) =>
            m.role === "user" ? (
              <p className="user-message" key={i}>{m.text}</p>
            ) : (
              <div className="assistant-message" key={i}>
                <span className="ask-bot">귤</span>
                <div>
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="answer-sources">{m.sources.map((s) => <span key={s}>{s}</span>)}</div>
                  )}
                </div>
              </div>
            ),
          )}
          {messages.length === 0 && (
            <div className="ask-suggestions"><span>이런 질문을 할 수 있어요</span><div>{SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div></div>
          )}
          <div className="ask-composer">
            <label htmlFor="bucket-question">질문 입력</label>
            <div>
              <input id="bucket-question" value={value} onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") ask(value); }}
                placeholder="예: 근처 흑돼지 맛집 추천해줘" disabled={busy} />
              <button onClick={() => ask(value)} disabled={busy || !value.trim()}>{busy ? "…" : "보내기"}</button>
            </div>
            <small>답변에는 참고한 자료의 출처가 함께 표시됩니다.</small>
          </div>
        </div>
        <aside className="knowledge-status">
          <span className="mini-label">KNOWLEDGE STATUS</span>
          <h2>지식베이스 연결됨</h2>
          <p>POI 21곳 + 숙소 FAQ 30건을 임베딩해 검색 가능한 지식으로 연결했어요.</p>
          <div className="rag-flow"><b>응답 방식</b><ol><li>질문 임베딩 · 근거 검색</li><li>거리 기준 재랭킹</li><li>근거 없으면 '모른다'로 안내</li></ol></div>
        </aside>
      </div>
    </section>
  );
}
