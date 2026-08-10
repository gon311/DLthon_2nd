import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { queryLogs } from "../../../db/schema";

// 개인정보 간단 비식별화(이메일/전화/과도한 길이 컷). 실제 운영 시 정책에 맞게 강화.
function deidentify(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, "[phone]")
    .slice(0, 500);
}

/** 질의 로그 저장 — AI 질문 응답 직후 호출 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sessionId?: string; question?: string; answered?: boolean;
    confidence?: number; retrievedIds?: string[]; answerPreview?: string; fallback?: boolean;
  } | null;
  if (!body?.sessionId || !body?.question) {
    return NextResponse.json({ error: "sessionId, question은 필수입니다." }, { status: 400 });
  }
  const db = getDb();
  const [row] = await db
    .insert(queryLogs)
    .values({
      sessionId: body.sessionId.slice(0, 64),
      question: deidentify(body.question),
      answered: Boolean(body.answered),
      confidence: typeof body.confidence === "number" ? body.confidence : null,
      retrievedIds: body.retrievedIds ? JSON.stringify(body.retrievedIds).slice(0, 500) : null,
      answerPreview: body.answerPreview ? deidentify(body.answerPreview) : null,
      fallback: Boolean(body.fallback),
    })
    .returning({ id: queryLogs.id });
  return NextResponse.json({ id: row.id });
}

/** 도움됐어요 / 아니요 피드백 반영 */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: number; feedback?: "helpful" | "not_helpful" } | null;
  if (!body?.id || (body.feedback !== "helpful" && body.feedback !== "not_helpful")) {
    return NextResponse.json({ error: "id, feedback(helpful|not_helpful) 필수" }, { status: 400 });
  }
  const db = getDb();
  await db.update(queryLogs).set({ feedback: body.feedback }).where(eq(queryLogs.id, body.id));
  return NextResponse.json({ ok: true });
}

/** 관리자/배치용: 최근 로그 조회 (미충족 질문 분석의 입력) */
export async function GET() {
  const db = getDb();
  const rows = await db.select().from(queryLogs).orderBy(desc(queryLogs.createdAt)).limit(500);
  return NextResponse.json({ logs: rows });
}
