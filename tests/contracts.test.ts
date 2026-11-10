import test from "node:test";
import assert from "node:assert/strict";
import { readingSchema, thresholdsSchema } from "../apps/web/src/schemas/index";
import { issueKey, hashKey } from "../apps/web/src/lib/auth/keys";
import { readJson, ApiError, sameOrigin } from "../apps/web/src/lib/http";
const id = "a0000000-0000-4000-8000-000000000001";
test("reading contract rejects out-of-range, partial, NaN, infinity and unknown properties", () => {
  for (const value of [
    { deviceId: id, temperature: 126, humidity: 50 },
    { deviceId: id, temperature: 20, humidity: -1 },
    { deviceId: id, temperature: NaN, humidity: 50 },
    { deviceId: id, temperature: Infinity, humidity: 50 },
    { deviceId: id, temperature: 20 },
    { deviceId: id, sensorError: true, temperature: 20 },
    { deviceId: id, temperature: 20, humidity: 50, owner_id: id },
  ])
    assert.equal(readingSchema.safeParse(value).success, false);
  assert.equal(
    readingSchema.safeParse({ deviceId: id, temperature: 24.5, humidity: 65.2 })
      .success,
    true,
  );
  assert.equal(
    readingSchema.safeParse({ deviceId: id, sensorError: true }).success,
    true,
  );
});
test("keys are independent 256-bit secrets with deterministic SHA256 hashes", () => {
  const a = issueKey(),
    b = issueKey();
  assert.notEqual(a.key, b.key);
  assert.match(a.key, /^sf_[A-Za-z0-9_-]{43}$/);
  assert.equal(a.hash, hashKey(a.key));
  assert.notEqual(a.hash, a.key);
});
test("threshold validation checks ordering and offline interval", () => {
  const v = {
    min_temperature: 18,
    max_temperature: 28,
    min_humidity: 50,
    max_humidity: 75,
    offline_after_seconds: 120,
  };
  assert.equal(thresholdsSchema.safeParse(v).success, true);
  assert.equal(
    thresholdsSchema.safeParse({ ...v, max_temperature: 17 }).success,
    false,
  );
  assert.equal(
    thresholdsSchema.safeParse({ ...v, offline_after_seconds: 10 }).success,
    false,
  );
});
test("size limit applies to streaming body without content-length", async () => {
  const req = new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "x".repeat(5000) }),
  });
  await assert.rejects(
    () => readJson(req),
    (e) => e instanceof ApiError && e.status === 413,
  );
});
test("browser mutation refuses cross origin and missing Origin", () => {
  assert.throws(() =>
    sameOrigin(
      new Request("http://localhost/api", {
        headers: { Origin: "https://evil.example" },
      }),
    ),
  );
  assert.throws(() => sameOrigin(new Request("http://localhost/api")));
  sameOrigin(
    new Request("http://localhost/api", {
      headers: { Origin: "http://localhost" },
    }),
  );
});
