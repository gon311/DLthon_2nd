# 프론트 연동 가이드 — AI 질문 탭

AI 질문 탭에서 답변을 받은 직후 질의를 로그로 남기고, 이용자가 정보를 제안할 수 있게 합니다.
익명 세션 id는 로그인 정보와 분리해 비식별로 사용합니다.

```ts
// 세션 식별자(비식별) — 최초 1회 생성해 메모리/쿠키에 보관
const sessionId = crypto.randomUUID();

// 1) 질의 로그 저장 (RAG 응답 직후)
async function logQuery(q: string, res: { answered: boolean; confidence?: number; retrievedIds?: string[]; answerPreview?: string; fallback?: boolean }) {
  const r = await fetch("/api/query-logs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, question: q, ...res }),
  });
  return (await r.json()).id as number; // 피드백에 사용
}

// 2) 도움됐어요 피드백
async function sendFeedback(logId: number, feedback: "helpful" | "not_helpful") {
  await fetch("/api/query-logs", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: logId, feedback }),
  });
}

// 3) 이용자 지식 제안 ("정보가 바뀌었어요" 버튼)
async function submitKnowledge(input: { targetName: string; category?: string; content: string; sourceHint?: string }) {
  const r = await fetch("/api/knowledge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return await r.json(); // { id, status: "pending" }
}
```

UI 힌트: 답변 카드 하단에 `👍 도움돼요 / 👎 아니요`와 `정보가 바뀌었나요? 알려주기` 링크를 붙이면 됩니다.
