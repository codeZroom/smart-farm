import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.E2E_BROWSER_CHANNEL || "msedge",
    headless: true,
    // Auth/device credentials appear in network traffic; never retain network traces.
    trace: "off",
  },
  reporter: [["list"]],
  webServer: {
    command:
      process.env.E2E_PRODUCTION === "1"
        ? "npm run start -w apps/web"
        : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
