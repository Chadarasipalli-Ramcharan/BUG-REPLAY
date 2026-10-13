"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bug,
  LayoutDashboard,
  ListTree,
  MonitorPlay,
  Settings2,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: ListTree },
  { href: "/issues", label: "Issues", icon: Bug },
  { href: "/demo", label: "Demo site", icon: MonitorPlay },
  { href: "/settings", label: "Settings & SDK", icon: Settings2 },
];

function LogoMark({ className = "h-7 w-7" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="12.5"
        stroke="#4d8dff"
        strokeWidth="2"
        strokeDasharray="58 21"
        strokeLinecap="round"
        transform="rotate(-60 16 16)"
      />
      <path d="M13 11.5 L22 16 L13 20.5 Z" fill="#4d8dff" />
    </svg>
  );
}

export default function AppShell({ children, title, subtitle, actions }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface/70 md:flex">
        <div className="flex items-center gap-2.5 border-b border-line-soft px-5 py-4">
          <LogoMark />
          <div>
            <div className="font-mono text-sm font-semibold tracking-tight text-ink">
              bugreplay
            </div>
            <div className="text-[10px] uppercase tracking-widest text-faint">
              session debugger
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                isActive(href)
                  ? "bg-accent/10 text-accent"
                  : "text-mute hover:bg-raised hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line-soft px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] text-faint">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            local instance
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-faint/80">
            Unauthenticated demo build — never expose publicly with real data.
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <LogoMark className="h-6 w-6" />
              <span className="font-mono text-sm font-semibold text-ink">
                bugreplay
              </span>
            </Link>
            <nav className="flex gap-1">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`rounded-md p-2 ${
                    isActive(href) ? "bg-accent/10 text-accent" : "text-mute"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {(title || actions) && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-ink">
                  {title}
                </h1>
                {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
