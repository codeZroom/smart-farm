import { createHash, randomBytes } from "node:crypto";
export const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("hex");
export function issueKey() {
  const key = `sf_${randomBytes(32).toString("base64url")}`;
  return { key, hash: hashKey(key) };
}
