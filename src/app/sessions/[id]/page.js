"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ListTree,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  AnomalyChip,
  EnvChip,
  ERROR_TYPES,
  EventIcon,
  EVENT_META,
  SeverityBadge,
} from "@/components/badges";
import { Card, EmptyState, ErrorState, Loading } from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { fmtClock, fmtDateTime, shortId } from "@/lib/format";

const STEP_MS = 1100;

export default function SessionDetailPage() {
  const { id } = useParams();
  const session = useApi(() => api.session(id), [id]);
  const ev = useApi(() => api.sessionEvents(id, { pageSize: 300 }), [id]);

  const events = ev.data?.events || [];
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rowRefs = useRef({});

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [id]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= events.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, STEP_MS / speed);
    return () => clearInterval(t);
  }, [playing, speed, events.length]);

  useEffect(() => {
    rowRefs.current[idx]?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  const s = session.data;
  const e = events[Math.min(idx, Math.max(0, events.length - 1))];

  if (session.error) {
    return (
      <AppShell title="Session">
        <ErrorState error={session.error} onRetry={session.refresh} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Session replay"
      subtitle="Event-based replay of the captured session — not pixel-perfect playback"
      actions={
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Sessions
        </Link>
      }
    >
      {session.loading || !s ? (
        <Loading label="Loading session…" />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 text-xs text-mute">
            <span className="font-mono text-ink">{shortId(s.id)}</span>
            <span>{fmtDateTime(s.startedAt)}</span>
            <span className="font-mono">{s.pageUrl}</span>
            <EnvChip environment={s.environment} />
            {(s.browserName || s.osName) && (
              <span>
                {s.browserName}
                {s.browserVersion ? ` ${s.browserVersion}` : ""}
                {s.osName ? ` on ${s.osName}` : ""}
                {s.deviceType ? ` · ${s.deviceType}` : ""}
              </span>
            )}
            <span>
              {s.eventCount} events ·{" "}
              <span className={s.errorCount ? "text-danger" : ""}>
                {s.errorCount} errors
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              anomaly <AnomalyChip score={s.anomaly?.score} />
            </span>
            {s.endedAt && <span className="text-faint">ended</span>}
          </div>

          {s.anomaly?.explanation && (
            <p className="rounded-md border border-line-soft bg-surface/50 px-4 py-2.5 text-xs text-faint">
              {s.anomaly.explanation}
            </p>
          )}

          {ev.error ? (
            <ErrorState error={ev.error} onRetry={ev.refresh} />
          ) : ev.loading ? (
            <Loading label="Loading event timeline…" />
          ) : events.length === 0 ? (
            <EmptyState
              icon={ListTree}
              title="No events captured"
              body="This session exists but has no events yet."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-5">
              {/* ---- Timeline + replay controls ---- */}
              <div className="xl:col-span-3">
                <Card
                  padded={false}
                  title="Timeline"
                  subtitle={`${events.length} event${
                    events.length === 1 ? "" : "s"
                  }${
                    (ev.data?.total || 0) > events.length
                      ? ` (showing latest ${events.length} of ${ev.data.total})`
                      : ""
                  }`}
                  action={
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSpeed((v) => (v === 1 ? 2 : 1))}
                        className="rounded-md border border-line bg-raised px-2 py-1 font-mono text-[11px] text-mute hover:text-ink"
                        title="Toggle playback speed"
                      >
                        {speed}×
                      </button>
                      <button
                        onClick={() => {
                          setIdx(0);
                          setPlaying(false);
                        }}
                        title="Back to start"
                        className="rounded-md border border-line bg-raised p-1.5 text-mute hover:text-ink"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setIdx((i) => Math.max(0, i - 1))}
                        disabled={idx <= 0}
                        title="Previous event"
                        className="rounded-md border border-line bg-raised p-1.5 text-mute hover:text-ink disabled:opacity-40"
                      >
                        <SkipBack className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (idx >= events.length - 1) setPlaying(false);
                          setPlaying((p) => !p);
                        }}
                        disabled={events.length === 0}
                        title={playing ? "Pause" : "Play"}
                        className="rounded-md bg-accent p-1.5 text-white hover:bg-accent-deep"
                      >
                        {playing ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setIdx((i) => Math.min(events.length - 1, i + 1))
                        }
                        disabled={idx >= events.length - 1}
                        title="Next event"
                        className="rounded-md border border-line bg-raised p-1.5 text-mute hover:text-ink disabled:opacity-40"
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  }
                >
                  <div className="border-b border-line-soft px-4 py-2.5">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, events.length - 1)}
                      value={idx}
                      onChange={(ev2) => setIdx(Number(ev2.target.value))}
                      className="w-full"
                      aria-label="Timeline position"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
                      <span>
                        {fmtClock(events[0].at)}
                      </span>
                      <span>
                        {idx + 1} / {events.length}
                      </span>
                      <span>{fmtClock(events[events.length - 1].at)}</span>
                    </div>
                  </div>
                  <ul className="max-h-[520px] overflow-y-auto">
                    {events.map((evItem, i) => {
                      const isErr = ERROR_TYPES.has(evItem.type);
                      const selected = i === idx;
                      return (
                        <li
                          key={evItem.id}
                          ref={(node) => {
                            rowRefs.current[i] = node;
                          }}
                          onClick={() => {
                            setIdx(i);
                            setPlaying(false);
                          }}
                          className={`flex cursor-pointer items-start gap-3 border-b border-line-soft/60 px-4 py-2.5 transition-colors last:border-0 ${
                            selected
                              ? "bg-accent/10"
                              : "hover:bg-raised/60"
                          } ${
                            isErr
                              ? "border-l-2 border-l-danger"
                              : "border-l-2 border-l-transparent"
                          }`}
                        >
                          <span className="w-[104px] shrink-0 pt-0.5 font-mono text-[10px] leading-4 text-faint">
                            {fmtClock(evItem.at)}
                          </span>
                          <EventIcon type={evItem.type} className="mt-1 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm ${
                                isErr ? "text-danger" : "text-ink"
                              }`}
                            >
                              {evItem.name || EVENT_META[evItem.type].label}
                            </span>
                            <span className="block truncate font-mono text-[10px] text-faint">
                              {evItem.pageUrl}
                              {evItem.selector ? ` · ${evItem.selector}` : ""}
                              {evItem.payload?.status ? ` · HTTP ${evItem.payload.status}` : ""}
                              {evItem.payload?.durationMs != null
                                ? ` · ${evItem.payload.durationMs}ms`
                                : ""}
                            </span>
                          </span>
                          {evItem.issue && (
                            <Link
                              href={`/issues/${evItem.issue.id}`}
                              onClick={(ev2) => ev2.stopPropagation()}
                              className="shrink-0"
                            >
                              <SeverityBadge severity={evItem.issue.severity} />
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>

              {/* ---- Detail panel ---- */}
              <div className="xl:col-span-2">
                <Card title="Event detail" subtitle="Selected event" padded={false}>
                  {e ? (
                    <div className="space-y-4 p-4">
                      <div className="flex items-center gap-2">
                        <EventIcon type={e.type} className="h-4 w-4" />
                        <span className="font-mono text-xs uppercase tracking-wider text-mute">
                          {e.type}
                        </span>
                        <span className="ml-auto font-mono text-[10px] text-faint">
                          #{e.seq}
                        </span>
                      </div>

                      {e.name && (
                        <div>
                          <Label>What happened</Label>
                          <p className="text-sm text-ink">{e.name}</p>
                        </div>
                      )}

                      <div>
                        <Label>Timestamp (UTC)</Label>
                        <p className="font-mono text-xs text-mute">
                          {new Date(e.at).toISOString()}
                        </p>
                      </div>

                      {e.selector && (
                        <div>
                          <Label>Target</Label>
                          <p className="break-all font-mono text-xs text-mute">
                            {e.selector}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label>Page</Label>
                        <p className="break-all font-mono text-xs text-mute">
                          {e.pageUrl}
                        </p>
                      </div>

                      {(e.type === "http_error" ||
                        e.type === "network_error") && (
                        <div className="flex flex-wrap gap-2">
                          {e.payload?.status && (
                            <Chip
                              label="status"
                              value={e.payload.status}
                              tone={
                                e.payload.status >= 500
                                  ? "danger"
                                  : "warn"
                              }
                            />
                          )}
                          {e.payload?.method && (
                            <Chip label="method" value={e.payload.method} />
                          )}
                          {e.payload?.reason && (
                            <Chip
                              label="reason"
                              value={e.payload.reason}
                              tone="danger"
                            />
                          )}
                          {e.payload?.durationMs != null && (
                            <Chip
                              label="duration"
                              value={`${e.payload.durationMs} ms`}
                            />
                          )}
                        </div>
                      )}

                      {e.issue && (
                        <Link
                          href={`/issues/${e.issue.id}`}
                          className="block rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 transition-colors hover:bg-danger/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-ink">
                              Grouped into issue
                            </span>
                            <SeverityBadge severity={e.issue.severity} />
                          </div>
                          <p className="mt-1 truncate text-xs text-mute">
                            {e.issue.title}
                          </p>
                        </Link>
                      )}

                      {e.payload &&
                        Object.keys(e.payload).length > 0 && (
                          <div>
                            <Label>Payload</Label>
                            <pre className="max-h-48 overflow-auto rounded-md border border-line-soft bg-bg px-3 py-2 font-mono text-[11px] leading-5 text-mute">
                              {JSON.stringify(e.payload, null, 2)}
                            </pre>
                          </div>
                        )}

                      {e.payload?.stack && (
                        <div>
                          <Label>Stack trace</Label>
                          <pre className="max-h-56 overflow-auto rounded-md border border-danger/20 bg-bg px-3 py-2 font-mono text-[11px] leading-5 text-danger/90">
                            {e.payload.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-faint">
                      Select an event in the timeline.
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function Label({ children }) {
  return (
    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-faint">
      {children}
    </div>
  );
}

function Chip({ label, value, tone = "default" }) {
  const cls =
    tone === "danger"
      ? "border-danger/40 text-danger"
      : tone === "warn"
        ? "border-warn/40 text-warn"
        : "border-line text-mute";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border bg-raised px-2 py-1 font-mono text-[11px] ${cls}`}
    >
      <span className="text-faint">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  );
}
