import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const text = execSync("npx --yes supabase@2.58.5 status -o json", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const status = JSON.parse(text.slice(text.indexOf("{")));
const url = status.API_URL;
if (!url || new URL(url).hostname !== "127.0.0.1")
  throw new Error("Only project-local Supabase at 127.0.0.1 is allowed.");
if (existsSync("apps/web/.env.local")) {
  const current = readFileSync("apps/web/.env.local", "utf8")
    .match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]
    .trim()
    .replace(/^["']|["']$/g, "");
  if (current && current !== url)
    throw new Error(
      "기존 .env.local이 다른 DB를 가리킵니다. 설정을 별도 보관한 후 로컬 테스트를 실행해 주세요.",
    );
}
const db = createClient(url, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const email = `dev-${Date.now()}@smartfarm.test`,
  password = randomBytes(24).toString("base64url");
const { data, error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw new Error("Local test user creation failed.");
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/test-account.json",
  JSON.stringify({ email, password, id: data.user.id }),
);
writeFileSync(".local/supabase.json", JSON.stringify(status));
const cron = randomBytes(24).toString("hex");
writeFileSync(
  "apps/web/.env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}\nAPP_ORIGIN=http://localhost:3000\nCRON_SECRET=${cron}\n`,
);
writeFileSync(".local/cron-secret", cron);
console.log(
  "로컬 개발 계정과 환경변수를 준비했습니다. 계정: .local/test-account.json (비밀값 출력 생략)",
);
