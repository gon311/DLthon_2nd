// 지식베이스(POI + 숙소 FAQ) → 임베딩 JSON 생성.
// PL 백엔드(build_index.py)와 동일한 문서 포맷을 사용해 평가 버전과 지식을 일치시킨다.
// 실행:  OPENAI_API_KEY=sk-... node frontend/scripts/build_knowledge_embeddings.mjs
//   입력: data/processed/guesthouse_pois.csv, data/processed/guesthouse_faq.json
//   출력: frontend/app/api/ask/knowledge_embeddings.json
import fs from "node:fs";

const LAT = 33.2124518, LNG = 126.2598287;
const EMBED_MODEL = "text-embedding-3-small";
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error("OPENAI_API_KEY 필요"); process.exit(1); }

const hav = (la, ln) => {
  const R = 6371000, r = Math.PI/180;
  const p1 = LAT*r, p2 = la*r, dp = (la-LAT)*r, dl = (ln-LNG)*r;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

function parseCsv(p) {
  const [head, ...lines] = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return lines.map(l => { const v=l.split(","); return Object.fromEntries(cols.map((c,i)=>[c, v[i]])); });
}

// POI 문서 (build_document_text와 동일)
const pois = parseCsv("data/processed/guesthouse_pois.csv").map(r => {
  const dist = hav(+r.lat, +r.lng);
  let text = `${r.name}은(는) ${r.category_norm}으로, ${r.description||""}. 숙소에서 약 ${dist}m 거리에 있다.`;
  if (r.stop_lat && r.stop_lng) {
    const sd = hav(+r.stop_lat, +r.stop_lng);
    // POI 인근 정류장 거리(도보) — 원본과 동일하게 근거리일 때만
    const poiToStop = Math.round(6371000*2*Math.atan2(
      Math.sqrt(Math.sin(((+r.stop_lat)-(+r.lat))*Math.PI/360)**2 + Math.cos((+r.lat)*Math.PI/180)*Math.cos((+r.stop_lat)*Math.PI/180)*Math.sin(((+r.stop_lng)-(+r.lng))*Math.PI/360)**2),
      Math.sqrt(1-(Math.sin(((+r.stop_lat)-(+r.lat))*Math.PI/360)**2 + Math.cos((+r.lat)*Math.PI/180)*Math.cos((+r.stop_lat)*Math.PI/180)*Math.sin(((+r.stop_lng)-(+r.lng))*Math.PI/360)**2))));
    if (poiToStop <= 300) text += ` 인근 정류장: ${r.nearest_stop_name}, 도보 약 ${poiToStop}m.`;
  }
  return { id: `poi-${r.poi_id}`, name: r.name, category: r.category_norm, distance_m: dist, kind: "poi", text };
});

// 숙소 FAQ 문서 (build_guesthouse_faq_text와 동일)
const kb = JSON.parse(fs.readFileSync("data/processed/guesthouse_faq.json", "utf8"));
const ghName = kb.guesthouse?.name_ko || "버킷 제주 게스트하우스";
const faqs = (kb.faq || []).map(f => {
  let lines = [`[${ghName}] ${f.category}`, `Q: ${f.question}`, `A: ${f.answer}`];
  if (f.location) lines.push(`위치: ${f.location}`);
  if (f.available_hours) lines.push(`운영시간: ${f.available_hours}`);
  if (f.price_krw) lines.push(`가격: ${Number(f.price_krw).toLocaleString()}원`);
  return { id: `faq-${f.id}`, name: `${ghName} FAQ`, category: f.category, distance_m: 0, kind: "faq", text: lines.join(" ") };
});

const docs = [...pois, ...faqs];
console.log(`문서 ${docs.length}건 (POI ${pois.length} + FAQ ${faqs.length}) 임베딩 중…`);

async function embed(inputs) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  return (await res.json()).data.map(d => d.embedding);
}

const out = [];
for (let i = 0; i < docs.length; i += 64) {
  const batch = docs.slice(i, i+64);
  const embs = await embed(batch.map(d => d.text));
  batch.forEach((d, j) => out.push({ ...d, embedding: embs[j] }));
}
fs.mkdirSync("frontend/app/api/ask", { recursive: true });
fs.writeFileSync("frontend/app/api/ask/knowledge_embeddings.json", JSON.stringify(out));
console.log(`완료 → frontend/app/api/ask/knowledge_embeddings.json (${out.length}건, dim ${out[0].embedding.length})`);
