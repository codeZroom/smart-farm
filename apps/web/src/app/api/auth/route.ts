import { NextResponse } from "next/server";
import { configured, userClient } from "@/lib/supabase/server";
import { sameOrigin, readJson, failure, ApiError } from "@/lib/http";
import { loginSchema } from "@/schemas";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    if (!configured())
      throw new ApiError(503, "Supabase 환경변수를 설정해 주세요.");
    const result = loginSchema.safeParse(await readJson(req));
    if (!result.success)
      throw new ApiError(400, "이메일과 8자 이상 비밀번호를 입력해 주세요.");
    const db = await userClient();
    const { error } = await db.auth.signInWithPassword(result.data);
    if (error) throw new ApiError(401, "로그인 정보를 확인해 주세요.");
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const db = await userClient();
    await db.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
