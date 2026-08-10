import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { displayName?: unknown }
    | null;
  const displayName =
    typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (displayName.length < 2 || displayName.length > 20) {
    return NextResponse.json(
      { error: "닉네임은 2자 이상 20자 이하로 입력해 주세요." },
      { status: 400 },
    );
  }

  await getDb()
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ displayName });
}

