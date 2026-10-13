# Architecture

## Stack adaptation note

The original PRD specified Python/FastAPI + SQLAlchemy + SQLite. This
sandbox only serves a **Next.js 16 + PostgreSQL/Drizzle** application, so
the backend is implemented as Next.js route handlers and the analysis
services as plain ES modules. All product behavior, the `/api/v1`
contract, and the SDK are unchanged. All application code is plain
JavaScript per the delivery requirement.

## Data flow

1. **Capture** — `public/sdk/bugreplay.js` (loaded via `<script>` tag)
   creates a session with `POST /api/v1/sessions`, instruments
   clicks / `history.pushState` / `window.onerror` /
   `unhandledrejection` / `console.error` / `fetch`, and batches events
   (≤50) to `POST /api/v1/sessions/:id/events` every 2 s or on `pagehide`.
   The queue is bounded (200), retries are bounded (2), and a failure of
   the backend never crashes the monitored page. The SDK skips its own
   outbound requests so it never reports itself.
2. **Ingestion** — `src/lib/pipeline.js` validates every event
   (type whitelist, 10-day timestamp window, 500-char URL, 200-char
   names/selectors, 8 KB JSON payload, 50-event batch), re-scrubs
   sensitive payload keys, and inserts events with a monotonically
   increasing `sequence_number`. `idempotency_key` makes retries safe.
3. **Aggregation** — error-like events are classified
   (`src/lib/fingerprint.js`), fingerprinted (sha256 over normalized
   kind + message + top 3 stack frames), and upserted into `issues`
   (unique per project+fingerprint). Every occurrence is recorded in
   `issue_occurrences`, and counts / affected sessions / severity are
   recomputed from that table — repeated errors never duplicate issues.
4. **Analysis** — `src/lib/analysis.js` (pure, isomorphic):
   - `normalizeMessage` / `topFrames`: strip line:col, URLs, hex
     addresses, UUIDs → stable grouping
   - `computeSeverity`: transparent rules (documented in code + README)
   - `diagnosticHints`: rule-based hypotheses, each with its evidence
   - `scoreSessionEvents`: deterministic anomaly score (errors, failed
     requests, error ratio, max repeat) with band + explanation
5. **Presentation** — React pages fetch exclusively through
   `src/lib/client.js`; every number on the dashboard comes from the
   database. No fabricated data paths exist — errors render as explicit
   error states.

## Severity rules (heuristics, not business-impact assessments)

| Rule | Result |
| --- | --- |
| 5xx / unhandled JS, ≥4 sessions or ≥8 occurrences | `critical` |
| 5xx / unhandled JS, ≥2 sessions or ≥3 occurrences | `high` |
| First 5xx, unhandled JS error, 401/403, network failure | `medium` |
| Other 4xx, console errors | `low` |

Severity only escalates on new occurrences; it never auto-degrades.

## Security model (MVP)

- No secrets are exposed to the browser; all config is server-side env.
- CORS: explicit origin allowlist (`BUGREPLAY_CORS_ORIGINS`), no wildcard.
- In-memory rate limiting on ingestion (120/min/session, 480/min/client).
- Demo reset is destructive and gated by `BUGREPLAY_ENV != "production"`.
- **No authentication** — local single-user demo; do not expose publicly.
