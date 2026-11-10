import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ""}`);
  const actual = Buffer.from(req.headers.get("authorization") || "");
  if (
    !process.env.CRON_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return NextResponse.json({ error: "인증 실패" }, { status: 401 });
  const { data, error } = await adminClient().rpc("detect_offline");
  return NextResponse.json(
    error ? { error: "오프라인 검사 실패" } : { processed: data },
    { status: error ? 503 : 200 },
  );
}
