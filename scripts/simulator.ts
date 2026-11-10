import { setTimeout as pause } from "node:timers/promises";
const base = process.env.SIMULATOR_URL || "http://localhost:3000";
if (
  process.env.NODE_ENV === "production" ||
  process.env.SIMULATOR_ENV !== "development"
)
  throw new Error("SIMULATOR_ENV=development에서만 실행할 수 있습니다.");
const url = new URL(base);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
  process.env.SIMULATOR_ALLOW_REMOTE !== "development-only"
)
  throw new Error(
    "원격 개발 서버는 SIMULATOR_ALLOW_REMOTE=development-only를 명시하세요.",
  );
const deviceId = process.env.SIMULATOR_DEVICE_ID;
const key = process.env.SIMULATOR_DEVICE_KEY;
if (!deviceId || !key) throw new Error("장치 ID와 키가 필요합니다.");
const scenario = process.argv[2] || "normal";
const scenarios: Record<string, [number, number]> = {
  normal: [23, 62],
  hot: [36, 62],
  cold: [8, 62],
  humid: [23, 92],
  dry: [23, 25],
};
if (
  ![...Object.keys(scenarios), "offline", "auth-fail", "sensor-error"].includes(
    scenario,
  )
)
  throw new Error("알 수 없는 시나리오");
if (scenario === "offline") {
  console.log(
    "전송을 중단합니다. 임계시간 이후 오프라인 표시와 스케줄러 알림을 확인하세요.",
  );
  process.exit(0);
}
const once = process.argv.includes("--once");
async function main() {
  do {
    const [t, h] = scenarios[scenario] || [23, 62];
    const payload = {
      deviceId,
      firmwareVersion: "simulator-1.0.0",
      ...(scenario === "sensor-error"
        ? { sensorError: true }
        : {
            temperature: Number((t + Math.random() - 0.5).toFixed(2)),
            humidity: Number((h + Math.random() * 2 - 1).toFixed(2)),
          }),
    };
    try {
      const res = await fetch(new URL("/api/v1/devices/readings", url), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${scenario === "auth-fail" ? "sf_" + "x".repeat(43) : key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      console.log(
        new Date().toISOString(),
        scenario,
        res.status,
        await res.text(),
      );
      if (once && !res.ok && scenario !== "auth-fail") process.exitCode = 1;
    } catch {
      console.error("서버 연결에 실패했습니다.");
      if (once) process.exitCode = 1;
    }
    if (!once) await pause(30000);
  } while (!once);
}
main().catch(() => {
  console.error("시뮬레이터 실행에 실패했습니다.");
  process.exitCode = 1;
});
