import { NextResponse } from "next/server";
import { z } from "zod";
import { userClient } from "@/lib/supabase/server";
import { ApiError, failure } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const db = await userClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new ApiError(401, "로그인이 필요합니다.");
    const u = new URL(req.url);
    const device = u.searchParams.get("device");
    const sensor = u.searchParams.get("sensor") || "water_temperature";
    const hours = Number(u.searchParams.get("hours") || 24);
    if (
      !z.uuid().safeParse(device).success ||
      ![1, 24, 168, 720].includes(hours) ||
      ![
        "water_temperature",
        "co2",
        "uv_voltage",
        "uv_raw",
        "air_temperature",
        "air_humidity",
        "soil_1_moisture",
        "soil_1_temperature",
        "soil_1_ec",
        "soil_2_moisture",
        "soil_2_temperature",
        "soil_2_ec",
      ].includes(sensor)
    )
      throw new ApiError(400, "조회 조건을 확인해 주세요.");
    const [latest, history] = await Promise.all([
      db.rpc("latest_sensor_measurements", { p_device: device }),
      db.rpc("sensor_measurement_history", {
        p_device: device,
        p_hours: hours,
        p_sensor: sensor,
      }),
    ]);
    if (latest.error || history.error)
      throw new ApiError(503, "센서 데이터를 조회하지 못했습니다.");
    return NextResponse.json(
      { latest: latest.data, history: history.data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
