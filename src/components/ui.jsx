"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
  ServerCrash,
} from "lucide-react";

export function Spinner({ className = "h-5 w-5" }) {
  return <Loader2 className={`animate-spin text-accent ${className}`} />;
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-mute">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-raised">
        <Icon className="h-5 w-5 text-faint" />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-mute">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, hint }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger/5 px-6 py-12 text-center">
      <ServerCrash className="mb-3 h-6 w-6 text-danger" />
      <h3 className="text-sm font-semibold text-ink">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-mute">
        {error?.message || "Unknown error"}
      </p>
      {hint && <p className="mt-2 max-w-md text-xs text-faint">{hint}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent/50 hover:text-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = "text-accent" }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line/80">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
          {label}
        </span>
        {Icon && <Icon className={`h-4 w-4 ${tone}`} />}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold text-ink">
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-mute">{sub}</div>}
    </div>
  );
}

export function Card({ title, subtitle, action, children, className = "", padded = true }) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-2 py-1 font-mono text-[11px] text-mute transition-colors hover:border-accent/50 hover:text-accent"
    >
      {copied ? (
        <Check className="h-3 w-3 text-ok" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

export function Pagination({ page, totalPages, total, onChange }) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between px-1 py-2 text-xs text-faint">
        <span>
          {total} result{total === 1 ? "" : "s"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-1 py-2">
      <span className="text-xs text-faint">
        {total} results · page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-raised px-2.5 py-1 text-xs text-mute transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3 w-3" /> Prev
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-raised px-2.5 py-1 text-xs text-mute transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, busy }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled, busy, tone }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-mute transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger" ? "hover:border-danger/50 hover:text-danger" : "hover:border-accent/40"
      }`}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
