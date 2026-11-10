import { NextResponse } from "next/server";
import { z } from "zod";
import { userClient, configured, adminClient } from "@/lib/supabase/server";
import { sameOrigin, readJson, failure, ApiError } from "@/lib/http";
import {
  farmSchema,
  zoneSchema,
  deviceSchema,
  thresholdsSchema,
} from "@/schemas";
import { issueKey } from "@/lib/auth/keys";
export async function GET(req: Request) {
  try {
    if (!configured()) throw new ApiError(503, "Supabase 설정이 필요합니다.");
    const db = await userClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new ApiError(401, "로그인이 필요합니다.");
    const url = new URL(req.url);
    const device = url.searchParams.get("device");
    const period = url.searchParams.get("period") || "24h";
    const hours: Record<string, number> = {
      "1h": 1,
      "24h": 24,
      "7d": 168,
      "30d": 720,
    };
    if (!hours[period] || (device && !z.uuid().safeParse(device).success))
      throw new ApiError(400, "조회 조건을 확인해 주세요.");
    const [farms, zones, devices, thresholds, alerts, latest] =
      await Promise.all([
        db.from("farms").select("*").order("created_at"),
        db.from("farm_zones").select("*").order("created_at"),
        db.from("devices").select("*").order("created_at"),
        db.from("device_thresholds").select("*"),
        db
          .from("alerts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        db.rpc("latest_readings"),
      ]);
    for (const result of [farms, zones, devices, thresholds, alerts, latest])
      if (result.error) throw new ApiError(503, "데이터 조회에 실패했습니다.");
    let history = null;
    if (device) {
      const result = await db.rpc("reading_history", {
        p_device: device,
        p_hours: hours[period],
      });
      if (result.error) throw new ApiError(503, "통계 조회에 실패했습니다.");
      history = result.data;
    }
    return NextResponse.json(
      {
        farms: farms.data,
        zones: zones.data,
        devices: devices.data,
        thresholds: thresholds.data,
        alerts: alerts.data,
        latest: latest.data,
        history,
        email: user.email,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const db = await userClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new ApiError(401, "로그인이 필요합니다.");
    const body = await readJson(req);
    const envelope = z
      .object({
        action: z.enum([
          "farm",
          "zone",
          "device",
          "update-device",
          "thresholds",
          "rotate",
          "revoke",
          "resolve",
          "profile",
        ]),
        id: z.uuid().optional(),
        data: z.unknown().optional(),
      })
      .strict()
      .safeParse(body);
    if (!envelope.success) throw new ApiError(422, "잘못된 요청입니다.");
    const { action, id, data } = envelope.data;
    let error;
    let key: string | undefined;
    if (action === "farm") {
      const value = farmSchema.safeParse(data);
      if (!value.success) throw new ApiError(422, "농장 이름을 확인해 주세요.");
      ({ error } = await db
        .from("farms")
        .insert({ ...value.data, owner_id: user.id }));
    }
    if (action === "zone") {
      const value = zoneSchema.safeParse(data);
      if (!value.success) throw new ApiError(422, "구역 정보를 확인해 주세요.");
      ({ error } = await db.from("farm_zones").insert(value.data));
    }
    if (action === "device") {
      const value = deviceSchema.safeParse(data);
      if (!value.success) throw new ApiError(422, "장치 정보를 확인해 주세요.");
      const issued = issueKey();
      const result = await db.rpc("register_device", {
        p_zone: value.data.farm_zone_id,
        p_name: value.data.name,
        p_hash: issued.hash,
      });
      error = result.error;
      if (!error) key = issued.key;
    }
    if (
      ["update-device", "thresholds", "rotate", "revoke", "resolve"].includes(
        action,
      )
    ) {
      if (!id) throw new ApiError(422, "ID가 필요합니다.");
    }
    if (action === "update-device") {
      const value = deviceSchema.safeParse(data);
      if (!value.success) throw new ApiError(422, "장치 정보를 확인해 주세요.");
      ({ error } = await db
        .from("devices")
        .update(value.data)
        .eq("id", id)
        .select("id")
        .single());
    }
    if (action === "thresholds") {
      const value = thresholdsSchema.safeParse(data);
      if (!value.success)
        throw new ApiError(422, "임계값 범위를 확인해 주세요.");
      ({ error } = await db
        .from("device_thresholds")
        .upsert({ ...value.data, device_id: id }, { onConflict: "device_id" }));
    }
    if (action === "rotate" || action === "revoke") {
      const { data: owned, error: ownershipError } = await db
        .from("devices")
        .select("id")
        .eq("id", id)
        .single();
      if (ownershipError || !owned)
        throw new ApiError(404, "장치를 찾을 수 없습니다.");
      const issued = issueKey();
      const result = await adminClient().rpc("rotate_credential", {
        p_device: id,
        p_hash: action === "rotate" ? issued.hash : null,
      });
      error = result.error;
      if (!error && action === "rotate") key = issued.key;
    }
    if (action === "resolve") {
      ({ error } = await db
        .from("alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .single());
    }
    if (action === "profile") {
      const value = z
        .object({ password: z.string().min(12).max(128) })
        .strict()
        .safeParse(data);
      if (!value.success)
        throw new ApiError(422, "비밀번호를 12자 이상 입력해 주세요.");
      ({ error } = await db.auth.updateUser(value.data));
    }
    if (error && "code" in error && error.code === "PGRST116")
      throw new ApiError(404, "대상을 찾을 수 없습니다.");
    if (error)
      throw new ApiError(
        400,
        "저장하지 못했습니다. 권한과 입력값을 확인해 주세요.",
      );
    return NextResponse.json(
      { ok: true, ...(key ? { key } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
