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
import { useEffect, useRef, useState } from "react";
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
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const onResize = () => { if (window.innerWidth >= 768) setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("resize", onResize); };
  }, [open]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <header className="mobile-header">
        <Link href="/dashboard" className="brand">
          <Sprout />
          온실
        </Link>
        <button
          ref={menuButton}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && <button type="button" className="menu-backdrop" aria-label="메뉴 닫기" tabIndex={-1} onClick={() => { setOpen(false); menuButton.current?.focus(); }} />}
      <aside id="main-navigation" className={open ? "sidebar open" : "sidebar"}>
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
              aria-current={pathname.startsWith(href) ? "page" : undefined}
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
      <main id="main-content" className="workspace" tabIndex={-1} inert={open}>{children}</main>
    </div>
  );
}
