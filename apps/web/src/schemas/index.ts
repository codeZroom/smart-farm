import { z } from "zod";
const sensorValue = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable().optional();
export const multiReadingSchema = z
  .object({
    deviceId: z.uuid(),
    firmwareVersion: z.string().max(64).optional(),
    readings: z
      .object({
        water_temperature: sensorValue(-55, 125),
        co2: sensorValue(0, 10000),
        uv_voltage: sensorValue(0, 3300),
        uv_raw: sensorValue(0, 4095),
        air_temperature: sensorValue(-40, 125),
        air_humidity: sensorValue(0, 100),
        soil_1_moisture: sensorValue(0, 100),
        soil_1_temperature: sensorValue(-55, 125),
        soil_1_ec: sensorValue(0, 100000),
        soil_2_moisture: sensorValue(0, 100),
        soil_2_temperature: sensorValue(-55, 125),
        soil_2_ec: sensorValue(0, 100000),
      })
      .strict(),
    sensorStatuses: z
      .record(z.string(), z.enum(["warming", "error", "disconnected"]))
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!Object.values(v.readings).some((value) => typeof value === "number"))
      ctx.addIssue({
        code: "custom",
        message: "최소 하나의 유효한 측정값이 필요합니다.",
      });
    for (const [key, status] of Object.entries(v.sensorStatuses || {}))
      if (
        !(key in v.readings) ||
        v.readings[key as keyof typeof v.readings] !== null ||
        !status
      )
        ctx.addIssue({
          code: "custom",
          message: "상태는 null로 명시된 센서에만 지정할 수 있습니다.",
        });
  });
export const readingSchema = z
  .object({
    deviceId: z.uuid(),
    temperature: z.number().min(-40).max(125).optional(),
    humidity: z.number().min(0).max(100).optional(),
    firmwareVersion: z.string().max(64).optional(),
    sensorError: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.sensorError === true
        ? v.temperature === undefined && v.humidity === undefined
        : v.temperature !== undefined && v.humidity !== undefined,
    "측정값 두 개 또는 sensorError가 필요합니다.",
  );
export const thresholdsSchema = z
  .object({
    min_temperature: z.number().min(-40).max(125),
    max_temperature: z.number().min(-40).max(125),
    min_humidity: z.number().min(0).max(100),
    max_humidity: z.number().min(0).max(100),
    offline_after_seconds: z.number().int().min(60).max(86400),
  })
  .strict()
  .refine(
    (v) =>
      v.min_temperature < v.max_temperature && v.min_humidity < v.max_humidity,
    "최솟값은 최댓값보다 작아야 합니다.",
  );
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
export const farmSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500).default(""),
  })
  .strict();
export const zoneSchema = farmSchema.extend({ farm_id: z.uuid() });
export const deviceSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    farm_zone_id: z.uuid(),
    device_type: z.literal("ESP32_SHT31").default("ESP32_SHT31"),
    is_active: z.boolean().default(true),
  })
  .strict();
