import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
// build_knowledge_embeddings.mjs 로 생성. [{id,name,category,distance_m,kind,text,embedding[]}]
import KB from "./knowledge_embeddings.json";

const EMBED_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o-mini"; // 배포 시 원하는 모델로 교체 가능
const SIM_THRESHOLD = 0.30;       // 이보다 낮으면 근거 부족 → 폴백
// 인덱스에 없는 카테고리 → 고정 응답(할루시네이션 방지). PL 백엔드와 동일 취지.
const MISSING = ["약국", "병원", "응급", "마트", "주유소", "은행", "ATM", "우체국"];

type Doc = { id: string; name: string; category: string; distance_m: number; kind: string; text: string; embedding: number[] };
const DOCS = KB as unknown as Doc[];

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
}

async function openai(path: string, body: unknown) {
  const key = (env as Record<string, string>).OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 미설정");
  const res = await fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openai ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

const FIXED = (kw: string) =>
  `죄송합니다, 현재 안내 정보에는 ${kw} 데이터가 포함되어 있지 않습니다. 정확한 안내를 위해 프런트 데스크에 문의해 주세요.`;
const FALLBACK = "죄송합니다, 관련 정보를 찾지 못했습니다. 정확한 안내를 위해 프런트 데스크에 문의해 주세요.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { question?: string; sessionId?: string } | null;
  const q = body?.question?.trim();
  if (!q) return NextResponse.json({ error: "question은 필수입니다." }, { status: 400 });

  // 1) 없는 카테고리 → 고정 응답(환각 방지)
  const miss = MISSING.find((k) => q.includes(k));
  if (miss) {
    const answer = FIXED(miss);
    log(body?.sessionId, q, { answered: false, fallback: true, confidence: 0, retrievedIds: [] });
    return NextResponse.json({ answer, sources: [], confidence: 0, fallback: true });
  }

  try {
    // 2) 질의 임베딩 → 코사인 상위 → 거리 보정 재랭킹 → top-3
    const [qEmb] = ((await openai("embeddings", { model: EMBED_MODEL, input: [q] })) as { data: { embedding: number[] }[] }).data.map((d) => d.embedding);
    const scored = DOCS.map((d) => ({ d, sim: cosine(qEmb, d.embedding) })).sort((a, b) => b.sim - a.sim);
    const top = scored.slice(0, 6)
      .sort((a, b) => (b.sim - a.sim) || (a.d.distance_m - b.d.distance_m)) // 유사도 우선, 가까운 순 보정
      .slice(0, 3);

    // 3) 근거 부족 → 폴백(지어내지 않음)
    if (!top.length || top[0].sim < SIM_THRESHOLD) {
      log(body?.sessionId, q, { answered: false, fallback: true, confidence: top[0]?.sim ?? 0, retrievedIds: [] });
      return NextResponse.json({ answer: FALLBACK, sources: [], confidence: top[0]?.sim ?? 0, fallback: true });
    }

    // 4) 컨텍스트 기반 답변 생성(확인 안 된 정보 단정 금지)
    const context = top.map((t, i) => `[${i + 1}] ${t.d.text}`).join("\n");
    const chat = (await openai("chat/completions", {
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content:
          "너는 '버킷 제주 게스트하우스' 안내 도우미다. 아래 컨텍스트에 있는 정보만 근거로 답한다. " +
          "컨텍스트에 없으면 모른다고 답하고 지어내지 않는다. 거리·근거를 포함해 간결하게 답하되, " +
          "확인되지 않은 정보는 '~일 것 같다'처럼 단정하지 않는다. 질문과 직접 관련된 정보만 답한다." },
        { role: "user", content: `질문: ${q}\n\n컨텍스트:\n${context}` },
      ],
    })) as { choices: { message: { content: string } }[] };
    const answer = chat.choices[0].message.content.trim();
    const sources = [...new Set(top.map((t) => t.d.name))];
    log(body?.sessionId, q, { answered: true, fallback: false, confidence: top[0].sim, retrievedIds: top.map((t) => t.d.id) });
    return NextResponse.json({ answer, sources, confidence: Number(top[0].sim.toFixed(3)), fallback: false });
  } catch (e) {
    return NextResponse.json({ error: "일시적으로 답변할 수 없어요.", detail: String(e) }, { status: 500 });
  }
}

// 질의 로그(선택) — 이용자 참여형 지식 파이프라인과 연동. 실패해도 응답에 영향 없음.
function log(sessionId: string | undefined, question: string, r: { answered: boolean; fallback: boolean; confidence: number; retrievedIds: string[] }) {
  try {
    const base = (env as Record<string, string>).SELF_BASE_URL || "";
    fetch(`${base}/api/query-logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId || "anon", question, ...r }),
    }).catch(() => {});
  } catch { /* noop */ }
}
