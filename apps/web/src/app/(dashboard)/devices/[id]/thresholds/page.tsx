import { Monitor } from "@/features/monitor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Monitor view="thresholds" id={id} />;
}
