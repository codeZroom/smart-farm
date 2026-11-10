import { redirect } from "next/navigation";
import { configured, userClient } from "@/lib/supabase/server";
import { Shell } from "@/components/dashboard/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configured())
    return (
      <main className="setup">
        <h1>온실 연결을 준비해 주세요</h1>
        <p>
          apps/web/.env.local에 Supabase URL과 공개 키를 설정한 뒤 개발 서버를
          다시 실행해 주세요.
        </p>
        <p>
          README의 로컬 설치 순서에 따라 SQL 마이그레이션과 Auth 계정을
          준비하시면 됩니다.
        </p>
        <a href="/login">로그인 화면</a>
      </main>
    );
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return <Shell>{children}</Shell>;
}
