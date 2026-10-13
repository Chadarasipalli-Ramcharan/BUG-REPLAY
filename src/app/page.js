"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  Bug,
  Database,
  FlaskConical,
  Play,
  Users,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import {
  AnomalyChip,
  EnvChip,
  EventIcon,
  SeverityBadge,
  StatusBadge,
} from "@/components/badges";
import {
  Card,
  EmptyState,
  ErrorState,
  GhostButton,
  Loading,
  PrimaryButton,
  StatCard,
} from "@/components/ui";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { shortId, timeAgo } from "@/lib/format";

const TrendChart = dynamic(() => import("@/components/TrendChart"), {
  ssr: false,
  loading: () => <Loading label="Rendering trend…" />,
});

export default function DashboardPage() {
  const stats = useApi(() => api.stats(), []);
  const sess = useApi(() => api.sessions({ pageSize: 6 }), []);
  const iss = useApi(() => api.issues({ pageSize: 6 }), []);

  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState(null);

  async function loadDemo() {
    setSeeding(true);
    setSeedError(null);
    try {
      await api.seed();
      stats.refresh();
      sess.refresh();
      iss.refresh();
    } catch (err) {
      setSeedError(err.message);
    } finally {
      setSeeding(false);
    }
  }

  const isEmpty =
    stats.data &&
    stats.data.totalSessions === 0 &&
    stats.data.totalEvents === 0 &&
    stats.data.openIssues === 0;

  return (
    <AppShell
      title="Dashboard"
      subtitle="Live view of captured sessions, errors, and grouped issues"
      actions={
        <>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-1.5 text-sm text-mute transition-colors hover:border-accent/40 hover:text-ink"
          >
            <Play className="h-3.5 w-3.5" /> Open demo site
          </Link>
          <PrimaryButton onClick={loadDemo} busy={seeding}>
            <FlaskConical className="h-3.5 w-3.5" />
            Load demo data
          </PrimaryButton>
        </>
      }
    >
      {seedError && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          Failed to load demo data: {seedError}
        </div>
      )}

      {stats.error ? (
        <ErrorState
          error={stats.error}
          onRetry={stats.refresh}
          hint="The dashboard reads every number from the BugReplay API. If you run the services separately, start the backend first and retry."
        />
      ) : stats.loading ? (
        <Loading label="Loading dashboard…" />
      ) : isEmpty ? (
        <EmptyState
          icon={Database}
          title="No sessions captured yet"
          body="Open the demo site and interact with it — or load the deterministic demo dataset to explore the full investigation workflow."
          action={
            <div className="flex gap-2">
              <PrimaryButton onClick={loadDemo} busy={seeding}>
                <FlaskConical className="h-3.5 w-3.5" /> Load demo data
              </PrimaryButton>
              <Link href="/demo">
                <GhostButton>
                  <Play className="h-3.5 w-3.5" /> Open demo site
                </GhostButton>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Sessions"
              value={stats.data.totalSessions}
              sub="total captured"
              icon={Users}
            />
            <StatCard
              label="Events"
              value={stats.data.totalEvents}
              sub={
                Object.entries(stats.data.byType || {})
                  .slice(0, 2)
                  .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
                  .join(" · ")
              }
              icon={Activity}
            />
            <StatCard
              label="Open issues"
              value={stats.data.openIssues}
              sub="awaiting triage"
              icon={Bug}
              tone="text-warn"
            />
            <StatCard
              label="High / critical"
              value={stats.data.highSeverityIssues}
              sub="open or acknowledged"
              icon={Zap}
              tone="text-danger"
            />
            <StatCard
              label="Affected sessions"
              value={stats.data.affectedSessions}
              sub="sessions with errors"
              icon={Users}
              tone="text-high"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card
              title="Error trend — last 14 days"
              subtitle="console, uncaught, network, and HTTP errors per day"
              className="lg:col-span-2"
            >
              <TrendChart data={stats.data.trend || []} />
            </Card>
            <Card
              title="Events by type"
              subtitle="all time, from the events table"
              padded={false}
            >
              <ul className="divide-y divide-line-soft">
                {Object.entries(stats.data.byType || {}).length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-faint">
                    No events yet
                  </li>
                )}
                {Object.entries(stats.data.byType || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, n]) => (
                    <li
                      key={type}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2 text-sm text-mute">
                        <EventIcon type={type} />
                        {type.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-sm text-ink">{n}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card
              title="Recent sessions"
              padded={false}
              action={
                <Link
                  href="/sessions"
                  className="text-xs text-accent hover:underline"
                >
                  View all →
                </Link>
              }
            >
              {sess.loading ? (
                <Loading label="Loading sessions…" />
              ) : sess.error ? (
                <div className="p-4">
                  <ErrorState error={sess.error} onRetry={sess.refresh} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-wider text-faint">
                      <th className="px-4 py-2 font-medium">Session</th>
                      <th className="px-4 py-2 font-medium">Page</th>
                      <th className="px-4 py-2 font-medium">Env</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Events
                      </th>
                      <th className="px-4 py-2 text-right font-medium">Errors</th>
                      <th className="px-4 py-2 font-medium">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sess.data?.items || []).map((s) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer border-b border-line-soft/60 transition-colors last:border-0 hover:bg-raised/60"
                        onClick={() => (window.location.href = `/sessions/${s.id}`)}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-mute">
                          {shortId(s.id)}
                          <AnomalyChip score={s.anomalyScore} />
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-2.5 font-mono text-xs text-ink">
                          {s.pageUrl}
                        </td>
                        <td className="px-4 py-2.5">
                          <EnvChip environment={s.environment} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {s.eventCount}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {s.errorCount > 0 ? (
                            <span className="text-danger">{s.errorCount}</span>
                          ) : (
                            <span className="text-faint">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-mute">
                          {timeAgo(s.startedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card
              title="Latest issues"
              padded={false}
              action={
                <Link
                  href="/issues"
                  className="text-xs text-accent hover:underline"
                >
                  View all →
                </Link>
              }
            >
              {iss.loading ? (
                <Loading label="Loading issues…" />
              ) : iss.error ? (
                <div className="p-4">
                  <ErrorState error={iss.error} onRetry={iss.refresh} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-wider text-faint">
                      <th className="px-4 py-2 font-medium">Issue</th>
                      <th className="px-4 py-2 font-medium">Severity</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">
                        Occ.
                      </th>
                      <th className="px-4 py-2 font-medium">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(iss.data?.items || []).map((i) => (
                      <tr
                        key={i.id}
                        className="cursor-pointer border-b border-line-soft/60 transition-colors last:border-0 hover:bg-raised/60"
                        onClick={() => (window.location.href = `/issues/${i.id}`)}
                      >
                        <td className="max-w-[260px] px-4 py-2.5">
                          <div className="truncate text-xs text-ink">
                            {i.title}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <SeverityBadge severity={i.severity} />
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={i.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs">
                          {i.occurrenceCount}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-mute">
                          {timeAgo(i.lastSeenAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
