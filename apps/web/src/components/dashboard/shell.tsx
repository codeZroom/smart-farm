"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout,
  LayoutDashboard,
  Map,
  Radio,
  ChartNoAxesCombined,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
const links = [
  ["/dashboard", "대시보드", LayoutDashboard],
  ["/farms", "농장 · 구역", Map],
  ["/devices", "장치 관리", Radio],
  ["/statistics", "온습도 통계", ChartNoAxesCombined],
  ["/alerts", "알림 이력", Bell],
  ["/settings", "사용자 설정", Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <Link href="/dashboard" className="brand">
          <Sprout />
          온실
        </Link>
        <button
          aria-label="메뉴 열기"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link className="brand" href="/dashboard">
          <Sprout size={30} />
          온실<small>SMART FARM</small>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={pathname.startsWith(href) ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection">
            <span className="dot" />
            15초마다 자동 새로고침
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              location.href = "/login";
            }}
          >
            <LogOut size={17} />
            로그아웃
          </button>
          <small>온실 v1.0 · MONITORING</small>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
