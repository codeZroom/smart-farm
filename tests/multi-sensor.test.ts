import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { multiReadingSchema } from "../apps/web/src/schemas";
const a = "a0000000-0000-4000-8000-000000000001",
  b = "b0000000-0000-4000-8000-000000000002";
test("multi-sensor payload accepts partial readings and distinguishes null from omitted", () => {
  const body = {
    deviceId: a,
    readings: { water_temperature: 22.38, co2: null, uv_voltage: 2937 },
    sensorStatuses: { co2: "warming" },
  };
  assert.equal(multiReadingSchema.safeParse(body).success, true);
  assert.equal(
    multiReadingSchema.safeParse({ ...body, readings: { co2: null } }).success,
    false,
  );
  assert.equal(
    multiReadingSchema.safeParse({
      ...body,
      readings: { water_temperature: -127 },
    }).success,
    false,
  );
  assert.equal(
    multiReadingSchema.safeParse({
      ...body,
      sensorStatuses: { co2: "error", air_humidity: "disconnected" },
    }).success,
    false,
  );
  assert.equal(
    multiReadingSchema.safeParse({
      ...body,
      readings: { water_temperature: 22, uv_voltage: 3400 },
    }).success,
    false,
  );
});
test("migration preserves legacy data and isolates partial sensor readings", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261110105451_initial_smartfarm.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values('${a}'),('${b}');insert into farms(id,owner_id,name) values('${a}','${a}','farm');insert into farm_zones(id,farm_id,name) values('${a}','${a}','zone');insert into devices(id,farm_zone_id,name) values('${a}','${a}','device');insert into device_thresholds(device_id) values('${a}');insert into device_credentials(device_id,key_hash) values('${a}',repeat('a',64));insert into sensor_readings(device_id,temperature,humidity) values('${a}',24,65);`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261126142905_multi_sensor.sql",
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("select * from sensor_measurements")).rows.length,
      2,
    );
    await db.exec("set role service_role");
    const ingest = async (
      hash: string,
      readings: object,
      statuses: object = {},
    ) =>
      (
        await db.query<{ result: { status: number } }>(
          "select ingest_multi_reading($1,$2,$3,$4,$5) result",
          [a, hash, "2.0", JSON.stringify(readings), JSON.stringify(statuses)],
        )
      ).rows[0].result;
    assert.equal(
      (await ingest("b".repeat(64), { water_temperature: 22 })).status,
      401,
    );
    assert.equal(
      (
        await ingest(
          "a".repeat(64),
          { water_temperature: 22.38, co2: null, uv_voltage: 2937 },
          { co2: "warming" },
        )
      ).status,
      201,
    );
    assert.equal(
      (await ingest("a".repeat(64), { water_temperature: 22 })).status,
      429,
    );
    const entries = await db.query<{
      sensor_type: string;
      value: string | null;
      status: string;
    }>(
      "select sensor_type,value,status from sensor_measurements where device_id=$1",
      [a],
    );
    assert.equal(
      entries.rows.find((x) => x.sensor_type === "co2")?.status,
      "warming",
    );
    assert.equal(
      entries.rows.find((x) => x.sensor_type === "co2")?.value,
      null,
    );
    await db.query(
      "update devices set last_seen_at=now()-interval '30 seconds' where id=$1",
      [a],
    );
    const legacy = await db.query<{ result: { status: number } }>(
      "select ingest_reading($1,$2,30,66,'1.0',false) result",
      [a, "a".repeat(64)],
    );
    assert.equal(legacy.rows[0].result.status, 201);
    assert.equal(
      (
        await db.query(
          "select * from sensor_measurements where sensor_type='air_temperature' and value=30",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select * from alerts where alert_type='temperature_high' and resolved_at is null",
        )
      ).rows.length,
      1,
    );
    await db.query(
      "update devices set last_seen_at=now()-interval '30 seconds' where id=$1",
      [a],
    );
    assert.equal(
      (
        await ingest(
          "a".repeat(64),
          { water_temperature: 23, co2: null },
          { co2: "error" },
        )
      ).status,
      201,
    );
    const gap = await db.query<{ average: number | null }>(
      "select * from sensor_measurement_history($1,24,$2)",
      [a, "co2"],
    );
    assert.equal(gap.rows[0].average, null);
    assert.equal((await db.query("select * from alerts where alert_type='sensor_error' and resolved_at is null")).rows.length,1);
    await db.query("update devices set last_seen_at=now()-interval '30 seconds' where id=$1",[a]);
    await ingest('a'.repeat(64),{water_temperature:24});
    assert.equal((await db.query("select * from alerts where alert_type='sensor_error' and resolved_at is null")).rows.length,1,'omitted CO2 must not resolve its error');
    await db.query("update devices set last_seen_at=now()-interval '30 seconds' where id=$1",[a]);
    await ingest('a'.repeat(64),{water_temperature:24,co2:850});
    assert.equal((await db.query("select * from alerts where alert_type='sensor_error' and resolved_at is null")).rows.length,0,'CO2 recovery resolves error');
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${a}'`,
    );
    assert.equal(
      (await db.query("select * from latest_sensor_measurements($1)", [a])).rows
        .length,
      5,
    );
    assert.equal(
      (
        await db.query("select * from sensor_measurement_history($1,24,$2)", [
          a,
          "water_temperature",
        ])
      ).rows.length,
      1,
    );
    await db.exec(`set request.jwt.claim.sub='${b}'`);
    assert.equal(
      (await db.query("select * from sensor_measurements")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from latest_sensor_measurements($1)", [a])).rows
        .length,
      0,
    );
    await assert.rejects(() =>
      db.query("select ingest_multi_reading($1,$2,$3,$4,$5)", [
        a,
        "a".repeat(64),
        "x",
        JSON.stringify({ co2: 1000 }),
        "{}",
      ]),
    );
  } finally {
    await db.close();
  }
});
