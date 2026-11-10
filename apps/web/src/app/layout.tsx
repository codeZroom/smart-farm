import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = {
  title: { default: "온실 | Smart Farm", template: "%s | 온실" },
  description: "온도와 습도, 농장의 상태를 한눈에",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "온실", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173f35",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
