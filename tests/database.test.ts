import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { hashKey } from "../apps/web/src/lib/auth/keys";
test("real PostgreSQL migration: isolation, credentials, ingestion, aggregates and alert transitions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth, public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261110105451_initial_smartfarm.sql",
        "utf8",
      ),
    );
    const a = "a0000000-0000-4000-8000-000000000001",
      b = "b0000000-0000-4000-8000-000000000002";
    await db.exec(
      `insert into auth.users values('${a}'),('${b}');set role authenticated;set request.jwt.claim.sub='${a}';`,
    );
    const farm = (
      await db.query<{ id: string }>(
        `insert into farms(owner_id,name) values('${a}','농장 A') returning id`,
      )
    ).rows[0].id;
    const zone = (
      await db.query<{ id: string }>(
        `insert into farm_zones(farm_id,name) values('${farm}','구역 A') returning id`,
      )
    ).rows[0].id;
    const hash = hashKey("sf_" + "a".repeat(43));
    const device = (
      await db.query<{ id: string }>(
        `select register_device($1,'장치 A',$2) id`,
        [zone, hash],
      )
    ).rows[0].id;
    await assert.rejects(() => db.query("select * from device_credentials"));
    await assert.rejects(() =>
      db.query("update devices set last_seen_at=now() where id=$1", [device]),
    );
    await assert.rejects(() =>
      db.query(
        `insert into sensor_readings(device_id,temperature,humidity) values('${device}',20,60)`,
      ),
    );
    await db.exec(`set request.jwt.claim.sub='${b}'`);
    for (const table of [
      "farms",
      "farm_zones",
      "devices",
      "device_thresholds",
      "sensor_readings",
      "alerts",
    ])
      assert.equal(
        (await db.query(`select * from ${table}`)).rows.length,
        0,
        table,
      );
    await assert.rejects(() =>
      db.query(`insert into farm_zones(farm_id,name) values('${farm}','侵入')`),
    );
    await assert.rejects(() =>
      db.query("select register_device($1,$2,$3)", [
        zone,
        "bad",
        hashKey("bad"),
      ]),
    );
    await db.exec(`reset role;set role service_role;`);
    const ingest = async (
      temp: number | null,
      humidity: number | null,
      keyHash = hash,
      error = false,
    ) => {
      const result = await db.query<{ result: { status: number } }>(
        "select ingest_reading($1,$2,$3,$4,$5,$6) result",
        [device, keyHash, temp, humidity, "test-1.0", error],
      );
      return result.rows[0].result;
    };
    assert.equal((await ingest(24, 62, hashKey("wrong"))).status, 401);
    assert.equal((await ingest(36, 90)).status, 201);
    assert.equal((await ingest(36, 90)).status, 429);
    assert.equal(
      (await db.query("select * from sensor_readings")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from alerts where resolved_at is null")).rows
        .length,
      2,
    );
    await db.query(
      `update devices set last_seen_at=now()-interval '40 seconds' where id=$1`,
      [device],
    );
    await ingest(37, 92);
    assert.equal(
      (await db.query("select * from alerts")).rows.length,
      2,
      "no duplicate alerts",
    );
    await db.query(
      `update devices set last_seen_at=now()-interval '40 seconds' where id=$1`,
      [device],
    );
    await ingest(23, 60);
    assert.equal(
      (await db.query("select * from alerts where resolved_at is null")).rows
        .length,
      0,
    );
    await db.query(
      `update devices set last_seen_at=now()-interval '40 seconds' where id=$1`,
      [device],
    );
    await ingest(37, 92);
    assert.equal(
      (await db.query("select * from alerts")).rows.length,
      2,
      "cooldown suppresses repeats",
    );
    await db.query(
      `update devices set last_seen_at=now()-interval '40 seconds' where id=$1`,
      [device],
    );
    await ingest(null, null, hash, true);
    assert.equal(
      (
        await db.query(
          `select * from alerts where alert_type='sensor_error' and resolved_at is null`,
        )
      ).rows.length,
      1,
    );
    await db.query(
      `update devices set last_seen_at=now()-interval '3 minutes' where id=$1`,
      [device],
    );
    await db.query("select detect_offline()");
    await db.query("select detect_offline()");
    assert.equal(
      (await db.query(`select * from alerts where alert_type='offline'`)).rows
        .length,
      1,
    );
    await db.query("select rotate_credential($1,$2)", [device, hashKey("new")]);
    assert.equal((await ingest(23, 60)).status, 401);
    await db.exec(
      `reset role;set role authenticated;set request.jwt.claim.sub='${a}'`,
    );
    assert.equal(
      (await db.query("select * from latest_readings()")).rows.length,
      1,
    );
    assert.ok(
      (await db.query("select * from reading_history($1,24)", [device])).rows
        .length > 0,
    );
    await db.exec(`set request.jwt.claim.sub='${b}'`);
    assert.equal(
      (await db.query("select * from reading_history($1,24)", [device])).rows
        .length,
      0,
    );
    await assert.rejects(() =>
      db.query(`select ingest_reading($1,$2,20,60,'bad',false)`, [
        device,
        hash,
      ]),
    );
  } finally {
    await db.close();
  }
});
