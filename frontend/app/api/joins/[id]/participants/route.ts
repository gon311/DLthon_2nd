import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { joinParticipants, joins } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "로그인 후 참여할 수 있어요." }, { status: 401 });
  }

  const joinId = Number((await params).id);
  if (!Number.isInteger(joinId)) {
    return NextResponse.json({ error: "올바르지 않은 Join이에요." }, { status: 400 });
  }

  const db = getDb();
  const target = await db
    .select({
      ownerId: joins.ownerId,
      status: joins.status,
      scheduledAt: joins.scheduledAt,
      max: joins.maxParticipants,
    })
    .from(joins)
    .where(eq(joins.id, joinId))
    .limit(1);

  if (target.length === 0) {
    return NextResponse.json({ error: "Join을 찾을 수 없어요." }, { status: 404 });
  }
  if (target[0].ownerId === user.id) {
    return NextResponse.json({ error: "작성자는 자신의 Join에 참여할 수 없어요." }, { status: 403 });
  }

  const existing = await db
    .select({ status: joinParticipants.status })
    .from(joinParticipants)
    .where(and(eq(joinParticipants.joinId, joinId), eq(joinParticipants.userId, user.id)))
    .limit(1);

  if (existing[0]?.status === "신청") {
    await db
      .update(joinParticipants)
      .set({ status: "취소" })
      .where(and(eq(joinParticipants.joinId, joinId), eq(joinParticipants.userId, user.id)));
    return NextResponse.json({ joined: false });
  }

  const scheduledAt = target[0].scheduledAt instanceof Date
    ? target[0].scheduledAt
    : new Date(target[0].scheduledAt);
  if (target[0].status !== "모집중" || scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "모집이 완료된 Join이에요." }, { status: 409 });
  }

  const active = await db
    .select({ userId: joinParticipants.userId })
    .from(joinParticipants)
    .where(and(eq(joinParticipants.joinId, joinId), eq(joinParticipants.status, "신청")));
  if (active.length + 1 >= target[0].max) {
    return NextResponse.json({ error: "모집 인원이 모두 찼어요." }, { status: 409 });
  }

  if (existing.length > 0) {
    await db
      .update(joinParticipants)
      .set({ status: "신청" })
      .where(and(eq(joinParticipants.joinId, joinId), eq(joinParticipants.userId, user.id)));
  } else {
    await db.insert(joinParticipants).values({ joinId, userId: user.id, status: "신청" });
  }

  return NextResponse.json({ joined: true });
}

