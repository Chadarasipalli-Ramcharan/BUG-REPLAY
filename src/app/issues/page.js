"use client";

import { useState } from "react";
import { Bug, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import { SeverityBadge, StatusBadge } from "@/components/badges";
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
} from "@/components/ui";
import { api } from "@/lib/client";
import { useApi, useDebouncedValue } from "@/lib/useApi";
import { timeAgo } from "@/lib/format";

const STATUSES = ["all", "open", "acknowledged", "resolved"];
const SEVERITIES = ["all", "low", "medium", "high", "critical"];
const SORTS = [
  { value: "last_seen", label: "Last seen" },
  { value: "occurrences", label: "Occurrences" },
  { value: "created", label: "Created" },
];

export default function IssuesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [sort, setSort] = useState("last_seen");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q, 350);

  const data = useApi(
    () =>
      api.issues({
        q: debouncedQ || undefined,
        status: status === "all" ? undefined : status,
        severity: severity === "all" ? undefined : severity,
        sort,
        page,
        pageSize: 20,
      }),
    [debouncedQ, status, severity, sort, page]
  );

  function resetPage(fn) {
    fn();
    setPage(1);
  }

  return (
    <AppShell
      title="Issues"
      subtitle="Repeated errors, grouped by deterministic fingerprint"
    >
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
          <div className="relative min-w-[200px] flex-1 md:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(e) => resetPage(() => setQ(e.target.value))}
              placeholder="Search title or message…"
              className="w-full rounded-md border border-line bg-raised py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {STATUSES.map((st) => (
              <button
                key={st}
                onClick={() => resetPage(() => setStatus(st))}
                className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                  status === st
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line bg-raised text-mute hover:text-ink"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <select
            value={severity}
            onChange={(e) => resetPage(() => setSeverity(e.target.value))}
            className="rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-[11px] text-mute focus:border-accent/60 focus:outline-none"
          >
            {SEVERITIES.map((sv) => (
              <option key={sv} value={sv}>
                severity: {sv}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => resetPage(() => setSort(e.target.value))}
            className="ml-auto rounded-md border border-line bg-raised px-2 py-1.5 font-mono text-[11px] text-mute focus:border-accent/60 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                sort: {s.label.toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {data.loading ? (
          <Loading label="Loading issues…" />
        ) : data.error ? (
          <div className="p-4">
            <ErrorState error={data.error} onRetry={data.refresh} />
          </div>
        ) : data.data.total === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Bug}
              title="No issues match"
              body="Trigger errors from the demo site or load the demo dataset — repeated errors are grouped here automatically."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left text-[11px] uppercase tracking-wider text-faint">
                    <th className="px-4 py-2.5 font-medium">Issue</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Severity</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Occurrences
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Sessions
                    </th>
                    <th className="px-4 py-2.5 font-medium">First seen</th>
                    <th className="px-4 py-2.5 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.items.map((i) => (
                    <tr
                      key={i.id}
                      className="cursor-pointer border-b border-line-soft/60 transition-colors last:border-0 hover:bg-raised/60"
                      onClick={() =>
                        (window.location.href = `/issues/${i.id}`)
                      }
                    >
                      <td className="max-w-[320px] px-4 py-3">
                        <div className="truncate text-sm text-ink">
                          {i.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-mute">
                        {i.errorType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={i.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={i.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {i.occurrenceCount}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {i.affectedSessionCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-mute">
                        {timeAgo(i.firstSeenAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-mute">
                        {timeAgo(i.lastSeenAt)}
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
