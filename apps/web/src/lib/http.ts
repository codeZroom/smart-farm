import { NextResponse } from "next/server";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  return NextResponse.json(
    { error: "요청을 처리하지 못했습니다." },
    { status: 500 },
  );
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(req.url).origin;
  if (!origin || origin !== expected)
    throw new ApiError(403, "허용되지 않은 출처입니다.");
}
export async function readJson(req: Request, max = 4096) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")
  )
    throw new ApiError(415, "JSON이 필요합니다.");
  if (Number(req.headers.get("content-length")) > max)
    throw new ApiError(413, "요청이 너무 큽니다.");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "본문이 필요합니다.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ApiError(413, "요청이 너무 큽니다.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "JSON 형식이 잘못되었습니다.");
  }
}
