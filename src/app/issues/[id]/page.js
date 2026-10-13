"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileJson,
  Lightbulb,
  Loader2,
  MapPin,
  Route,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  SeverityBadge,
  StatusBadge,
  EventIcon,
} from "@/components/badges";
import {
  Card,
  CopyButton,
  EmptyState,
  ErrorState,
  GhostButton,
  Loading,
} from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { fmtDateTime, shortId, timeAgo } from "@/lib/format";

const TRANSITIONS = {
  open: ["acknowledged", "resolved"],
  acknowledged: ["open", "resolved"],
  resolved: ["open"],
};

export default function IssueDetailPage() {
  const { id } = useParams();
  const data = useApi(() => api.issue(id), [id]);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function changeStatus(target) {
    setBusy(target);
    setActionError(null);
    try {
      await api.updateIssue(id, target);
      data.refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (data.error) {
    return (
      <AppShell title="Issue">
        <ErrorState error={data.error} onRetry={data.refresh} />
      </AppShell>
    );
  }
  if (data.loading || !data.data) {
    return (
      <AppShell title="Issue">
        <Loading label="Loading issue…" />
      </AppShell>
    );
  }

  const { issue, occurrences, evidence, reproduction, hints } = data.data;

  return (
    <AppShell
      title={issue.title}
      actions={
        <Link
          href="/issues"
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Issues
        </Link>
      }
    >
      {actionError && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {actionError}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <SeverityBadge severity={issue.severity} />
        <StatusBadge status={issue.status} />
        <span className="font-mono text-xs text-mute">
          {issue.errorType.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-faint">
          first seen {timeAgo(issue.firstSeenAt)} · last seen{" "}
          {timeAgo(issue.lastSeenAt)}
        </span>
        <span className="flex items-center gap-1 text-xs text-faint">
          <MapPin className="h-3.5 w-3.5" />
          {issue.occurrenceCount} occurrences ·{" "}
          {issue.affectedSessionCount} session
          {issue.affectedSessionCount === 1 ? "" : "s"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {TRANSITIONS[issue.status].map((target) => (
            <GhostButton
              key={target}
              busy={busy === target}
              onClick={() => changeStatus(target)}
            >
              {busy === target && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Mark {target}
            </GhostButton>
          ))}
          <a
            href={api.reportJsonUrl(id)}
            download={`bugreplay-${issue.id.slice(0, 8)}.json`}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-mute transition-colors hover:border-accent/40 hover:text-accent"
          >
            <FileJson className="h-3.5 w-3.5" /> JSON
          </a>
          <a
            href={api.reportMdUrl(id)}
            download={`bugreplay-${issue.id.slice(0, 8)}.md`}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
          >
            <Download className="h-3.5 w-3.5" /> Markdown report
          </a>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Error" subtitle="Normalized message and latest stack trace">
            <p className="break-words rounded-md border border-line-soft bg-bg px-3 py-2.5 font-mono text-sm text-ink">
              {issue.message}
            </p>
            {issue.latestStackTrace ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-danger/20 bg-bg px-3 py-2 font-mono text-[11px] leading-5 text-danger/90">
                {issue.latestStackTrace}
              </pre>
            ) : (
              <p className="mt-3 text-xs text-faint">
                No stack trace captured for this error type.
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-faint">
              <span>fingerprint</span>
              <code className="rounded bg-raised px-2 py-0.5 font-mono text-[11px] text-mute">
                {issue.fingerprint}
              </code>
              <CopyButton text={issue.fingerprint} />
            </div>
          </Card>

          <Card title="Reproduction steps" subtitle="Derived from the events of the most recent occurrence">
            {reproduction.length ? (
              <ol className="space-y-2">
                {reproduction.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-mono text-[10px] text-mute">
                      {i + 1}
                    </span>
                    <span
                      className={
                        i === reproduction.length - 1
                          ? "text-danger"
                          : "text-ink"
                      }
                    >
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-faint">
                No reproduction sequence could be derived from captured events.
              </p>
            )}
          </Card>

          <Card title="Occurrence history" padded={false}>
            {occurrences.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No occurrences recorded" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-wider text-faint">
                      <th className="px-4 py-2.5 font-medium">When</th>
                      <th className="px-4 py-2.5 font-medium">Session</th>
                      <th className="px-4 py-2.5 font-medium">Page</th>
                      <th className="px-4 py-2.5 font-medium">
                        Triggering event
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {occurrences.map((o) => (
                      <tr key={o.id} className="border-b border-line-soft/60 last:border-0">
                        <td className="px-4 py-2.5 text-xs text-mute">
                          {fmtDateTime(o.occurredAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/sessions/${o.sessionId}`}
                            className="font-mono text-xs text-accent hover:underline"
                          >
                            {shortId(o.sessionId)}
                          </Link>
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-2.5 font-mono text-xs text-mute">
                          {o.session?.pageUrl || "—"}
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-xs text-ink">
                          {o.event
                            ? `${o.event.type}${o.event.name ? `: ${o.event.name}` : ""}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Supporting evidence"
            subtitle="Triggering events and network failures from affected sessions"
            padded={false}
          >
            {evidence.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No evidence events" />
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {evidence.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-3 px-4 py-2.5">
                    <EventIcon type={ev.type} className="mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{ev.name}</p>
                      <p className="truncate font-mono text-[10px] text-faint">
                        {new Date(ev.at).toISOString()} · session{" "}
                        {shortId(ev.sessionId)} · {ev.pageUrl}
                      </p>
                      {ev.detail && (
                        <p className="mt-1 text-xs text-mute">{ev.detail}</p>
                      )}
                    </div>
                    <Link
                      href={`/sessions/${ev.sessionId}`}
                      className="shrink-0 text-xs text-accent hover:underline"
                    >
                      replay →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card
            title="Diagnostic suggestions"
            subtitle="Rule-based hypotheses tied to captured evidence — not confirmed root causes"
          >
            {hints.length === 0 ? (
              <p className="text-sm text-faint">
                No rule matched this issue yet.
              </p>
            ) : (
              <div className="space-y-3">
                {hints.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-md border border-line-soft bg-raised/50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-3.5 w-3.5 text-warn" />
                      <span className="text-xs font-semibold text-ink">
                        {h.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-mute">
                      {h.suggestion}
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] text-faint">
                      <Route className="mt-0.5 h-3 w-3 shrink-0" />
                      {h.evidence}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
