# API reference (v1)

Base: `/api/v1` — JSON in/out. Errors: `{"error": "message"}` with the
appropriate HTTP status. All timestamps are ISO-8601 UTC.

## Health

| Endpoint | Notes |
| --- | --- |
| `GET /api/health` · `GET /api/v1/health` | `503` when the database is unreachable |

## Stats

`GET /api/v1/stats`
→ `{ totalSessions, totalEvents, openIssues, highSeverityIssues,
affectedSessions, trend: [{day, errors}] (14 days), byType: {}, generatedAt }`

## Sessions

| Endpoint | Parameters |
| --- | --- |
| `GET /sessions` | `q` (page URL), `environment`, `errors=true`, `from`, `to`, `page`, `pageSize` (≤100) |
| `POST /sessions` | body: `{ projectId?, pageUrl?, browserName?, browserVersion?, osName?, deviceType?, environment? }` → `201 { session }` |
| `GET /sessions/:id` | metadata + computed anomaly + linked issues |
| `GET /sessions/:id/events` | `page`, `pageSize` (≤500); events ordered by `sequence_number`, each with an optional linked `issue` |
| `POST /sessions/:id/events` | `{ "events": [...] }` (≤50) or `{ "event": {...} }` |

### Event shape (ingestion)

```json
{
  "type": "click",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "pageUrl": "/demo",
  "name": "Submit order",
  "selector": "button[data-br-id=\"place-order\"]",
  "payload": { "x": 120, "y": 340 },
  "idempotencyKey": "br-abc-42"
}
```

- `type` (or `eventType`): `session_start | click | navigation |
  console_error | unhandled_error | network_error | http_error |
  custom_event | session_end`
- Constraints: payload ≤ 8 KB, batch ≤ 50, timestamp within 10 days,
  sensitive payload keys replaced with `"[redacted]"`, URLs sanitized
  (sensitive query params + fragments removed).
- Violations → `400`/`422` with the offending index, e.g.
  `"events[2]: invalid event_type"`.
- Replays with the same `idempotencyKey` → `skipped` (no duplicates).
- A `session_end` event marks the session ended and stores its anomaly
  score.

## Issues

| Endpoint | Parameters |
| --- | --- |
| `GET /issues` | `q`, `severity`, `status`, `sort` (`last_seen` \| `occurrences` \| `created`), pagination |
| `GET /issues/:id` | `{ issue, occurrences[], evidence[], reproduction[], hints[] }` |
| `PATCH /issues/:id` | `{ "status": "…" }` — transitions: `open→{acknowledged,resolved}`, `acknowledged→{open,resolved}`, `resolved→{open}`; violations → `409` |
| `GET /issues/:id/report` | structured JSON report |
| `GET /issues/:id/report.md` | Markdown attachment with repro steps, evidence, hints (labelled hypotheses), limitations |

## Demo utilities

| Endpoint | Notes |
| --- | --- |
| `POST /demo/seed` | deterministic 8-session dataset; safe to repeat (`alreadySeeded: true`) |
| `POST /demo/reset` | deletes demo-project data; `403` when `BUGREPLAY_ENV=production` |
| `GET /demo/fail?status=500` | controlled 4xx/5xx for the demo site |
| `GET /demo/slow` | responds after 4 s (for timeout demos) |
| `POST /demo/ok` | simulated successful business call |

## Ingestion limits

- Body ≤ 256 KB · payload ≤ 8 KB · batch ≤ 50 events
- Rate limits (in-memory): 120 requests/min/session, 480/min/client → `429`
