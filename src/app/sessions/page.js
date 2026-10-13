"use client";

import { useState } from "react";
import { ListTree, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { AnomalyChip, EnvChip } from "@/components/badges";
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
} from "@/components/ui";
import { api } from "@/lib/client";
import { useApi, useDebouncedValue } from "@/lib/useApi";
import { fmtDateTime, shortId } from "@/lib/format";

const ENVIRONMENTS = ["all", "development", "staging", "production"];

export default function SessionsPage() {
  const [q, setQ] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q, 350);

  const data = useApi(
    () =>
      api.sessions({
        q: debouncedQ || undefined,
        environment: environment === "all" ? undefined : environment,
        errors: errorsOnly ? "true" : undefined,
        page,
        pageSize: 20,
      }),
    [debouncedQ, environment, errorsOnly, page]
  );

  function resetPage(fn) {
    fn();
    setPage(1);
  }

  return (
    <AppShell
      title="Sessions"
      subtitle="Every captured browser session, newest first"
    >
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => resetPage(() => setQ(e.target.value))}
              placeholder="Search page URL…"
              className="w-full rounded-md border border-line bg-raised py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env}
                onClick={() => resetPage(() => setEnvironment(env))}
                className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                  environment === env
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line bg-raised text-mute hover:text-ink"
                }`}
              >
                {env}
              </button>
            ))}
          </div>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-mute">
            <input
              type="checkbox"
              checked={errorsOnly}
              onChange={(e) => resetPage(() => setErrorsOnly(e.target.checked))}
              className="h-3.5 w-3.5 accent-[#4d8dff]"
            />
            Errors only
          </label>
        </div>

        {data.loading ? (
          <Loading label="Loading sessions…" />
        ) : data.error ? (
          <div className="p-4">
            <ErrorState error={data.error} onRetry={data.refresh} />
          </div>
        ) : data.data.total === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ListTree}
              title="No sessions match"
              body="Capture a session from the demo site or load the demo dataset."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2.5 font-medium">Session</th>
                    <th className="px-4 py-2.5 font-medium">Started</th>
                    <th className="px-4 py-2.5 font-medium">Page</th>
                    <th className="px-4 py-2.5 font-medium">Env</th>
                    <th className="px-4 py-2.5 font-medium">Browser</th>
                    <th className="px-4 py-2.5 text-right font-medium">Events</th>
                    <th className="px-4 py-2.5 text-right font-medium">Errors</th>
                    <th className="px-4 py-2.5 text-right font-medium">Anomaly</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.items.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer border-b border-line-soft/60 transition-colors last:border-0 hover:bg-raised/60"
                      onClick={() =>
                        (window.location.href = `/sessions/${s.id}`)
                      }
                    >
                      <td className="px-4 py-3 font-mono text-xs text-mute">
                        {shortId(s.id)}
                      </td>
                      <td className="px-4 py-3 text-xs text-mute">
                        {fmtDateTime(s.startedAt)}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-ink">
                        {s.pageUrl}
                      </td>
                      <td className="px-4 py-3">
                        <EnvChip environment={s.environment} />
                      </td>
                      <td className="px-4 py-3 text-xs text-mute">
                        {s.browserName || "—"}
                        {s.deviceType ? ` · ${s.deviceType}` : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.eventCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {s.errorCount > 0 ? (
                          <span className="text-danger">{s.errorCount}</span>
                        ) : (
                          <span className="text-faint">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AnomalyChip score={s.anomalyScore} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line-soft px-4 py-1">
              <Pagination
                page={data.data.page}
                totalPages={data.data.totalPages}
                total={data.data.total}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
