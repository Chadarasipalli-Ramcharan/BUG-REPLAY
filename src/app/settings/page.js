"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card, CopyButton } from "@/components/ui";
import { EVENT_META } from "@/components/badges";

export default function SettingsPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const endpoint = origin ? `${origin}/api/v1` : "/api/v1";
  const sdkSnippet = `<script src="${origin || "http://localhost:3000"}/sdk/bugreplay.js"><\/script>
<script>
  BugReplay.init({
    endpoint: "${origin || "http://localhost:3000"}",
    projectId: "demo-project",
    environment: "development"
  });
<\/script>`;

  return (
    <AppShell
      title="Settings & integration"
      subtitle="API endpoint, SDK install, privacy behaviour, and known limitations"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Card
            title="Integration"
            subtitle="Point the SDK at this instance from any website"
          >
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wider text-faint">
                  API endpoint
                </dt>
                <dd className="flex items-center gap-2">
                  <code className="rounded bg-raised px-2 py-1 font-mono text-xs text-ink">
                    {endpoint}
                  </code>
                  <CopyButton text={endpoint} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs uppercase tracking-wider text-faint">
                  Project ID
                </dt>
                <dd className="flex items-center gap-2">
                  <code className="rounded bg-raised px-2 py-1 font-mono text-xs text-ink">
                    demo-project
                  </code>
                  <CopyButton text="demo-project" />
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-faint">
                  SDK install snippet
                </span>
                <CopyButton text={sdkSnippet} label="Copy snippet" />
              </div>
              <pre className="max-h-64 overflow-auto rounded-md border border-line-soft bg-bg px-3 py-2.5 font-mono text-[11px] leading-5 text-mute">
                {sdkSnippet}
              </pre>
              <p className="mt-2 text-xs text-faint">
                Custom events:{" "}
                <code className="font-mono">
                  BugReplay.track(&quot;name&quot;, {`{ safe: "payload" }`})
                </code>
                {" · "}stop:{" "}
                <code className="font-mono">BugReplay.stop()</code>
                {" · "}status:{" "}
                <code className="font-mono">BugReplay.getStatus()</code>
                {" · "}live feed:{" "}
                <code className="font-mono">BugReplay.onEvent(cb)</code>
              </p>
            </div>
          </Card>

          <Card
            title="Privacy by design"
            subtitle="What the SDK captures — and what it refuses to capture"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ok">
                  <ShieldCheck className="h-3.5 w-3.5" /> Captured
                </h4>
                <ul className="space-y-1.5 text-xs text-mute">
                  <li>· Session start / end and page URL (sanitized)</li>
                  <li>· Click metadata: tag, safe selector, button label</li>
                  <li>· pushState / popstate navigations</li>
                  <li>· Window errors with normalized stack traces</li>
                  <li>· Unhandled promise rejections</li>
                  <li>· console.error messages (original behaviour preserved)</li>
                  <li>· Failed fetches: method, URL, status, duration</li>
                  <li>· Custom events via the explicit track() API</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-danger">
                  <TriangleAlert className="h-3.5 w-3.5" /> Never captured
                </h4>
                <ul className="space-y-1.5 text-xs text-mute">
                  <li>· Password fields or their values</li>
                  <li>· Form values, typed text, keystrokes</li>
                  <li>· Cookies, authorization headers, tokens</li>
                  <li>· Full request or response bodies</li>
                  <li>· Sensitive query params (token, password, ssn, …)</li>
                  <li>· URL fragments</li>
                  <li>· Elements marked data-bugreplay-exclude</li>
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-faint">
                  This is a privacy-aware design, not a compliance statement.
                  Real deployments require consent, retention policy, and legal
                  review (GDPR/CCPA etc.).
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Supported event types" subtitle="Validated on ingestion; anything else is rejected with 422">
            <div className="flex flex-wrap gap-2">
              {Object.entries(EVENT_META).map(([type, meta]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 py-1.5 font-mono text-[11px] text-mute"
                >
                  <meta.icon className={`h-3.5 w-3.5 ${meta.cls}`} />
                  {type}
                </span>
              ))}
            </div>
          </Card>

          <Card
            title="Environment variables"
            subtitle="Server-side only — nothing secret is exposed to the browser"
          >
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line-soft text-[11px] uppercase tracking-wider text-faint">
                  <th className="py-2 pr-4 font-medium">Variable</th>
                  <th className="py-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft/60">
                {[
                  [
                    "DATABASE_URL",
                    "PostgreSQL connection string (required)",
                  ],
                  [
                    "BUGREPLAY_CORS_ORIGINS",
                    "Comma-separated origins allowed to ingest (no wildcard)",
                  ],
                  [
                    "BUGREPLAY_ENV",
                    'Set "production" to disable the demo reset endpoint',
                  ],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-2 pr-4">
                      <code className="font-mono text-mute">{k}</code>
                    </td>
                    <td className="py-2 text-mute">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Known limitations">
            <ul className="space-y-2 text-xs leading-relaxed text-mute">
              <li>
                · <strong className="text-ink">Unauthenticated demo build.</strong>{" "}
                No API keys on ingestion yet — do not expose this instance
                publicly with real data.
              </li>
              <li>
                · Event-based replay only: a faithful chronological timeline,
                not pixel-perfect visual playback.
              </li>
              <li>
                · In-memory rate limiting resets on server restart and does
                not survive multiple workers.
              </li>
              <li>
                · No retention policy enforcement yet — data is retained
                until you reset or delete the database.
              </li>
              <li>
                · The SDK instruments fetch, clicks, navigation, console.error
                and global error events only — XHR is not intercepted.
              </li>
              <li>
                · Severity labels and anomaly scores are transparent
                heuristics for triage, not measured business impact.
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-faint">
              Explore the live example at{" "}
              <Link href="/demo" className="text-accent hover:underline">
                /demo
              </Link>
              .
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
