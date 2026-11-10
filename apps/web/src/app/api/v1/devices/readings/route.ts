import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/server";
import { hashKey } from "@/lib/auth/keys";
import { readJson, ApiError, failure } from "@/lib/http";
import { readingSchema } from "@/schemas";
export async function POST(req: Request) {
  try {
    const token = req.headers
      .get("authorization")
      ?.match(/^Bearer (sf_[A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) throw new ApiError(401, "장치 인증에 실패했습니다.");
    const parsed = readingSchema.safeParse(await readJson(req));
    if (!parsed.success) throw new ApiError(422, "유효하지 않은 측정값입니다.");
    const r = parsed.data;
    const { data, error } = await adminClient().rpc("ingest_reading", {
      p_device: r.deviceId,
      p_hash: hashKey(token),
      p_temperature: r.temperature ?? null,
      p_humidity: r.humidity ?? null,
      p_firmware: r.firmwareVersion ?? null,
      p_sensor_error: r.sensorError ?? false,
    });
    if (error) throw new ApiError(503, "데이터 저장에 실패했습니다.");
    if (data.status !== 201)
      throw new ApiError(
        data.status,
        data.status === 429
          ? "전송 간격을 확인해 주세요."
          : "장치 인증에 실패했습니다.",
      );
    return NextResponse.json(
      { ok: true, recordedAt: data.recorded_at },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
