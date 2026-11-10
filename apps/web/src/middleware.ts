import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return res;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          values.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await client.auth.getUser();
  return res;
}
export const config = {
  runtime: "nodejs",
  matcher: [
    "/((?!api/v1/devices/readings|api/cron|_next/static|_next/image|favicon.ico|sw.js|offline|icons|manifest.webmanifest).*)",
  ],
};
