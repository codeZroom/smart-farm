import { test, expect, chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const account = JSON.parse(readFileSync(".local/test-account.json", "utf8"));
const local = JSON.parse(readFileSync(".local/supabase.json", "utf8"));
if (new URL(local.API_URL).hostname !== "127.0.0.1")
  throw new Error("E2E is local-only");
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
test("browser → Auth → farm/zone/device → simulator → DB → charts, alerts, isolation, PWA", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const invalidLogin = await context.request.post("/api/auth", {
    headers: { Origin: "http://localhost:3000" },
    data: { email: account.email, password: "invalid-password-123" },
  });
  expect(invalidLogin.status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
  const sessionCookies = (await context.cookies()).filter((c) =>
    c.name.includes("auth-token"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  expect(sessionCookies.every((c) => c.httpOnly)).toBe(true);
  await page.goto("/farms");
  await page.getByLabel("농장 이름", { exact: true }).fill("통합 검증 농장");
  await page.getByRole("button", { name: "농장 등록", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "통합 검증 농장", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "농장", exact: true })
    .selectOption({ label: "통합 검증 농장" });
  await page.getByLabel("구역 이름", { exact: true }).fill("온실 A");
  await page.getByRole("button", { name: "구역 등록", exact: true }).click();
  await expect(page.getByText("온실 A", { exact: true }).last()).toBeVisible();
  await page.goto("/devices");
  await page.getByLabel("장치 이름", { exact: true }).fill("ESP32 통합 센서");
  await page
    .getByRole("combobox", { name: "설치 구역", exact: true })
    .selectOption({ label: "통합 검증 농장 / 온실 A" });
  await page.getByRole("button", { name: "장치 등록", exact: true }).click();
  await expect(page.locator(".key-panel code")).toBeVisible();
  const key = await page.locator(".key-panel code").innerText();
  expect(key).toMatch(/^sf_/);
  await page.getByRole("button", { name: "보관했습니다 · 닫기" }).click();
  const { data: devices, error } = await admin
    .from("devices")
    .select("*")
    .eq("name", "ESP32 통합 센서")
    .order("created_at", { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  const device = devices![0];
  const simulate = (scenario: string) =>
    execFileSync(
      process.execPath,
      ["--import", "tsx", "scripts/simulator.ts", scenario, "--once"],
      {
        env: {
          ...process.env,
          SIMULATOR_ENV: "development",
          SIMULATOR_DEVICE_ID: device.id,
          SIMULATOR_DEVICE_KEY: key,
        },
        encoding: "utf8",
      },
    );
  expect(simulate("normal")).toContain("201");
  const { data: stored } = await admin
    .from("sensor_readings")
    .select("*")
    .eq("device_id", device.id);
  expect(stored).toHaveLength(1);
  await page.goto("/dashboard");
  await expect(page.locator(".metric").first()).toContainText(/2[23]\./);
  await expect(page.getByRole("img", { name: /온도 시간별/ })).toBeVisible();
  await admin
    .from("devices")
    .update({ last_seen_at: new Date(Date.now() - 40000).toISOString() })
    .eq("id", device.id);
  expect(simulate("hot")).toContain("201");
  await page.getByRole("button", { name: "데이터 새로고침" }).click();
  await expect(page.getByText("온도 상한 초과", { exact: true })).toBeVisible();
  const latest = await admin
    .from("sensor_readings")
    .select("*")
    .eq("device_id", device.id)
    .order("recorded_at", { ascending: false })
    .limit(1);
  expect(Number(latest.data![0].temperature)).toBeGreaterThan(35);
  const origin = "http://localhost:3000";
  const req = context.request;
  expect(
    (
      await req.post("/api/v1/devices/readings", {
        headers: { Authorization: `Bearer ${key}` },
        data: { deviceId: device.id, temperature: 20, humidity: 62 },
      })
    ).status(),
  ).toBe(429);
  expect(
    (
      await req.post("/api/v1/devices/readings", {
        headers: { Authorization: `Bearer ${key}` },
        data: { deviceId: device.id, temperature: 200, humidity: 62 },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await req.post("/api/v1/devices/readings", {
        data: { deviceId: device.id, temperature: 20, humidity: 62 },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await req.post("/api/manage", {
        headers: { Origin: "https://evil.example" },
        data: { action: "farm", data: { name: "bad" } },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await req.post("/api/v1/devices/readings", {
        headers: { Authorization: `Bearer ${key}` },
        data: { text: "x".repeat(5000) },
      })
    ).status(),
  ).toBe(413);
  for (const [scenario, type] of [
    ["cold", "temperature_low"],
    ["humid", "humidity_high"],
    ["dry", "humidity_low"],
    ["sensor-error", "sensor_error"],
  ] as const) {
    await admin
      .from("devices")
      .update({ last_seen_at: new Date(Date.now() - 40000).toISOString() })
      .eq("id", device.id);
    expect(simulate(scenario)).toContain("201");
    const { data: alert } = await admin
      .from("alerts")
      .select("id")
      .eq("device_id", device.id)
      .eq("alert_type", type)
      .is("resolved_at", null);
    expect(alert).toHaveLength(1);
  }
  await page.goto("/dashboard");
  await expect(page.locator(".device-intro .badge")).toHaveText("위험");
  // Another real Auth user cannot see A's records or register into A's zone.
  const b = await admin.auth.admin.createUser({
    email: `isolation-${Date.now()}@smartfarm.test`,
    password: account.password,
    email_confirm: true,
  });
  expect(b.error).toBeNull();
  const other = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false },
  });
  await other.auth.signInWithPassword({
    email: b.data.user!.email!,
    password: account.password,
  });
  for (const table of [
    "farms",
    "farm_zones",
    "devices",
    "sensor_readings",
    "device_thresholds",
    "alerts",
  ]) {
    const result = await other.from(table).select("*");
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  }
  expect(
    (await other.from("device_credentials").select("*")).error,
  ).not.toBeNull();
  expect(
    (
      await other.rpc("register_device", {
        p_zone: device.farm_zone_id,
        p_name: "invalid",
        p_hash: "a".repeat(64),
      })
    ).error,
  ).not.toBeNull();
  await admin.auth.admin.deleteUser(b.data.user!.id);
  await page.goto(`/devices/${device.id}/thresholds`);
  await page.getByLabel("최고 온도 (°C)").fill("40");
  await page.getByRole("button", { name: "임계값 저장" }).click();
  await expect(page.getByRole("status")).toContainText("저장했습니다");
  await page.goto(`/devices/${device.id}`);
  await expect(page.getByRole("heading", { name: "장치 정보" })).toBeVisible();
  await page.goto("/statistics");
  for (const p of ["1h", "7d", "30d", "24h"]) {
    await page.getByLabel("조회 기간").selectOption(p);
    await expect(
      page.getByRole("heading", { name: "기간 통계" }),
    ).toBeVisible();
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "대시보드", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /온도 시간별/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/dashboard-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(
    page.getByRole("link", { name: "장치 관리", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "장치 관리", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "새 장치 등록" }),
  ).toBeVisible();
  await page.locator("summary").first().click();
  await page
    .getByLabel("장치 이름", { exact: true })
    .last()
    .fill("이름 수정 센서");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(
    page.getByRole("heading", { name: "이름 수정 센서" }),
  ).toBeVisible();
  await admin
    .from("devices")
    .update({ last_seen_at: new Date(Date.now() - 180000).toISOString() })
    .eq("id", device.id);
  const cron = readFileSync(".local/cron-secret", "utf8");
  expect(
    (
      await req.get("/api/cron/offline", {
        headers: { Authorization: `Bearer ${cron}` },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/dashboard");
  await expect(
    page.getByText("장치 통신이 끊겼습니다.", { exact: true }),
  ).toBeVisible();
  await page.goto("/alerts");
  await page.getByRole("button", { name: "확인", exact: true }).first().click();
  await expect(page.getByText(/확인함/).first()).toBeVisible();
  // Rotation revokes the old key; inactive devices reject the new one.
  const rotate = await req.post("/api/manage", {
    headers: { Origin: origin },
    data: { action: "rotate", id: device.id },
  });
  expect(rotate.status()).toBe(200);
  const newKey = (await rotate.json()).key;
  expect(simulate("auth-fail")).toContain("401");
  expect(
    (
      await req.post("/api/v1/devices/readings", {
        headers: { Authorization: `Bearer ${key}` },
        data: { deviceId: device.id, temperature: 23, humidity: 62 },
      })
    ).status(),
  ).toBe(401);
  await admin.from("devices").update({ is_active: false }).eq("id", device.id);
  expect(
    (
      await req.post("/api/v1/devices/readings", {
        headers: { Authorization: `Bearer ${newKey}` },
        data: { deviceId: device.id, temperature: 23, humidity: 62 },
      })
    ).status(),
  ).toBe(401);
  const manifest = await (await req.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  expect(
    (
      await cdp.send("Page.getInstallabilityErrors")
    ).installabilityErrors.filter(
      (e: { errorId: string }) => e.errorId !== "in-incognito",
    ),
  ).toEqual([]);
  // A regular profile is required: Playwright's default context is incognito.
  const persistent = await chromium.launchPersistentContext(
    ".local/pwa-profile",
    { channel: process.env.E2E_BROWSER_CHANNEL || "msedge", headless: true },
  );
  try {
    const installPage = await persistent.newPage();
    await installPage.goto("http://localhost:3000/login");
    await installPage.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const installCdp = await persistent.newCDPSession(installPage);
    await installCdp.send("Page.enable");
    expect(
      (await installCdp.send("Page.getInstallabilityErrors"))
        .installabilityErrors,
    ).toEqual([]);
  } finally {
    await persistent.close();
  }
  expect(
    (await req.get("/icons/icon-192.png")).headers()["content-type"],
  ).toContain("image/png");
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "홈 화면에 설치" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "인터넷 연결이 필요합니다" }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("link", { name: "다시 연결하기" }).click();
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await req.delete("/api/auth", { headers: { Origin: origin } });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
});
