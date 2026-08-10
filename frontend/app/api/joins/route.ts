import { and, desc, eq, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { joinParticipants, joins, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const iconByKeyword: Record<string, string> = {
  여행: "🗺️",
  맛집: "🍜",
  산책: "🌿",
  액티비티: "🏄",
  기타: "🍊",
};

export async function GET() {
  const db = getDb();
  const now = new Date();
  const viewer = await getChatGPTUser();

  await db
    .update(joins)
    .set({ status: "모집완료" })
    .where(and(eq(joins.status, "모집중"), lte(joins.scheduledAt, now)));

  const rows = await db
    .select({
      id: joins.id,
      title: joins.title,
      description: joins.description,
      keyword: joins.keyword,
      location: joins.location,
      scheduledAt: joins.scheduledAt,
      max: joins.maxParticipants,
      status: joins.status,
      host: users.displayName,
      ownerId: joins.ownerId,
    })
    .from(joins)
    .innerJoin(users, eq(joins.ownerId, users.id))
    .orderBy(desc(joins.createdAt));

  const participantRows = await db
    .select({
      joinId: joinParticipants.joinId,
      userId: joinParticipants.userId,
      status: joinParticipants.status,
      displayName: users.displayName,
    })
    .from(joinParticipants)
    .innerJoin(users, eq(joinParticipants.userId, users.id));
  const activeParticipants = participantRows.filter((row) => row.status === "신청");

  return NextResponse.json({
    joins: rows.map((row) => {
      const participants = activeParticipants.filter((item) => item.joinId === row.id);
      const isOwner = viewer?.id === row.ownerId;
      return {
        ...toJoinItem(row, row.keyword, now),
        people: participants.length + 1,
        isOwner,
        joined: Boolean(viewer && participants.some((item) => item.userId === viewer.id)),
        participantNames: isOwner ? participants.map((item) => item.displayName) : undefined,
      };
    }),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "로그인 후 Join을 만들 수 있어요." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = text(body?.title, 40);
  const description = text(body?.description, 300);
  const location = text(body?.location, 60);
  const date = text(body?.date, 10);
  const time = text(body?.time, 5);
  const keyword = text(body?.keyword, 20) || "여행";
  const max = Number(body?.max);
  const scheduledAt = new Date(`${date}T${time}:00+09:00`);

  if (!title || !description || !location || Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "모든 항목을 올바르게 입력해 주세요." }, { status: 400 });
  }
  if (!Number.isInteger(max) || max < 2 || max > 20) {
    return NextResponse.json({ error: "모집 인원은 2명에서 20명 사이로 입력해 주세요." }, { status: 400 });
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "현재 이후의 일정을 선택해 주세요." }, { status: 400 });
  }

  const db = getDb();
  const owner = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, user.id)).limit(1);
  if (owner.length === 0) {
    return NextResponse.json({ error: "계정 정보를 준비한 뒤 다시 시도해 주세요." }, { status: 409 });
  }

  try {
    const created = await db
      .insert(joins)
      .values({ ownerId: user.id, title, description, keyword, location, scheduledAt, maxParticipants: max, status: "모집중" })
      .returning({ id: joins.id, status: joins.status });

    return NextResponse.json({
      join: {
        ...toJoinItem(
        { id: created[0].id, title, description, location, scheduledAt, max, status: created[0].status, host: owner[0].displayName },
        keyword,
        new Date(),
        ),
        isOwner: true,
        joined: false,
        participantNames: [],
      },
    });
  } catch {
    return NextResponse.json({ error: "같은 제목의 Join이 이미 있어요." }, { status: 409 });
  }
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function toJoinItem(
  row: { id: number; title: string; description: string; location: string; scheduledAt: Date; max: number; status: string; host: string },
  keyword: string,
  now: Date,
) {
  const scheduledAt = row.scheduledAt instanceof Date
    ? row.scheduledAt
    : new Date(row.scheduledAt);
  const korea = new Date(scheduledAt.getTime() + 9 * 60 * 60 * 1000);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    keyword,
    icon: iconByKeyword[keyword] ?? "🍊",
    date: korea.toISOString().slice(0, 10),
    time: korea.toISOString().slice(11, 16),
    max: row.max,
    people: 1,
    status: scheduledAt.getTime() <= now.getTime() && row.status === "모집중" ? "모집완료" : row.status,
    host: row.host,
  };
}

