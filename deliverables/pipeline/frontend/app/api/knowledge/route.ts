import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { knowledgeSubmissions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

/** 이용자가 "바뀐/새로운 정보"를 제안 — 검수 대기(pending)로 저장 */
export async function POST(request: Request) {
  const user = await getChatGPTUser(); // 익명 허용 시 null 가능
  const body = (await request.json().catch(() => null)) as {
    targetName?: string; category?: string; content?: string; sourceHint?: string;
  } | null;
  if (!body?.targetName || !body?.content) {
    return NextResponse.json({ error: "targetName, content은 필수입니다." }, { status: 400 });
  }
  const db = getDb();
  const [row] = await db
    .insert(knowledgeSubmissions)
    .values({
      submitterId: user?.id ?? null,
      targetName: body.targetName.slice(0, 120),
      category: body.category?.slice(0, 40) ?? null,
      content: body.content.slice(0, 1000),
      sourceHint: body.sourceHint?.slice(0, 300) ?? null,
    })
    .returning({ id: knowledgeSubmissions.id });
  return NextResponse.json({ id: row.id, status: "pending" });
}

/** 관리자: 검수 대기 목록 (?status=pending|approved|rejected) */
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const db = getDb();
  const rows = await db
    .select()
    .from(knowledgeSubmissions)
    .where(eq(knowledgeSubmissions.status, status))
    .orderBy(desc(knowledgeSubmissions.createdAt));
  return NextResponse.json({ submissions: rows });
}

/** 관리자: 검수 결과 반영 (approved/rejected). approved 건은 백엔드 ingest가 지식 스키마에 반영 */
export async function PATCH(request: Request) {
  const reviewer = await getChatGPTUser();
  const body = (await request.json().catch(() => null)) as { id?: number; status?: "approved" | "rejected" } | null;
  if (!body?.id || (body.status !== "approved" && body.status !== "rejected")) {
    return NextResponse.json({ error: "id, status(approved|rejected) 필수" }, { status: 400 });
  }
  const db = getDb();
  await db
    .update(knowledgeSubmissions)
    .set({ status: body.status, reviewedBy: reviewer?.id ?? "admin" })
    .where(and(eq(knowledgeSubmissions.id, body.id), eq(knowledgeSubmissions.status, "pending")));
  return NextResponse.json({ ok: true });
}
