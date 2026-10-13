# Testing

## Automated self-tests (executed)

```bash
node scripts/selftest.mjs
```

**Last run in this environment: 32 passed, 0 failed** (Node v22).

Covers:
- error normalization (whitespace, line:col, hex/UUID removal)
- `topFrames` stability across line numbers / machines
- fingerprint determinism; distinct errors stay distinct
- event classification (500 → http_error, abort → network_error)
- severity rules (medium → high → critical escalation; 404 low, 401 medium)
- diagnostic hints match their evidence (5xx, timeout, TypeError)
- anomaly score: clean session low, abnormal session high, deterministic
- privacy: `sanitizeUrl` strips sensitive params + fragments,
  `scrubPayload` redacts password/token keys

## Live HTTP E2E smoke tests (executed against the production build)

Performed with `curl` against `http://localhost:3000` after
`npm run build && npm run start`:

| Scenario | Result |
| --- | --- |
| `GET /api/health` | ✅ `{"ok":true,"database":"up"}` |
| `POST /demo/reset` then `POST /demo/seed` | ✅ 8 sessions / 54 events inserted |
| Second `POST /demo/seed` | ✅ `alreadySeeded:true` (no duplication) |
| `GET /api/v1/stats` | ✅ real aggregates: 8 sessions, 54 events, 8 issues, 14-day trend |
| `POST /api/v1/sessions` with `?access_token=` in URL | ✅ token stripped from stored `pageUrl` |
| Ingest batch with click + unhandled error | ✅ accepted; existing issue aggregated (occ 3→4, sessions 2→3, severity escalated to `high`) |
| Ingest batch with duplicate `idempotencyKey` replay | ✅ `skipped:1`, counts unchanged for the duplicate |
| Invalid `type` | ✅ `422 "events[0]: invalid event_type"` |
| Password key in payload | ✅ stored as `"[redacted]"` |
| `GET /issues/:id` | ✅ occurrences, evidence, repro steps, hints (`js-typeerror`, `reproducible`, `repeated`) |
| `GET /issues/:id/report` + `report.md` | ✅ JSON + Markdown attachment generated from DB data |
| `PATCH` status machine | ✅ allowed transitions 200; `resolved→acknowledged` → `409` |
| `pageSize=9999` | ✅ clamped to 100 |
| `?environment=moon` | ✅ `422` |
| Unknown session/issue IDs | ✅ `404` (after invalid-uuid fix) |

## Frontend checks (executed)

- `npx next typegen` — passes
- `npm exec tsc -- --noEmit` — passes (JS mode: `allowJs`, no type errors)
- `npm run build` — passes (production build)
- Page rendering: `/`, `/sessions`, `/issues`, `/settings`, `/demo` → 200

## Not executed (honest disclosure)

- **Playwright browser E2E** — headless browsers are unavailable in this
  sandbox. The browser-side SDK was therefore verified indirectly: the SDK
  talks to the same ingestion API that was exercised end-to-end above, and
  the demo page renders. A real-browser run (click → error → dashboard)
  remains to be verified in an environment with Chromium available.
- Python/pytest suites from the original PRD — superseded by this
  JavaScript stack (see `docs/architecture.md`).
