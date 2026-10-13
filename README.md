## 🐛 BUGREPLAY — THE TIME MACHINE FOR SOFTWARE BUGS

>>Welcome to **BugReplay** — a browser-session debugging platform that turns vague bug reports into **hard evidence**. Built for developers who are tired of hearing *"the login button doesn't work"* with zero context. This isn't just a dashboard — it's a **full observability pipeline**: a privacy-first browser SDK, a real ingestion API, deterministic error grouping, and exportable investigation reports.

---

## 💼 About the Project

Developers lose hours reproducing bugs they can't see. BugReplay solves this by capturing **what the user actually did** — every click, navigation, JavaScript error, and failed network request — then grouping repeated errors into issues, scoring sessions for anomalies, and generating evidence-backed bug reports.

From a controlled demo website → through a real SDK → into PostgreSQL → onto an investigation dashboard. Every number you see is read from the database. Nothing is faked.

### 🛢️ Core Technologies Used

| Category         | Technologies / Tools                               |
|------------------|----------------------------------------------------|
| Frontend         | React 19, Next.js 16 (App Router), JavaScript, JSX |
| Styling          | Tailwind CSS v4, Dark Graphite Design System       |
| UI/UX            | Recharts, Lucide Icons, Custom Replay Controls     |
| Backend          | Next.js Route Handlers, REST API `/api/v1`         |
| Database         | PostgreSQL, Drizzle ORM                            |
| Browser SDK      | Vanilla JavaScript (zero dependencies)             |
| Analysis Engine  | SHA-256 Fingerprinting, Rule-Based Diagnostics     |
| Testing          | Custom Self-Test Suite (31 assertions)             |
| DevOps           | Docker, Docker Compose, Vercel, Neon               |
| Version Control  | Git, GitHub                                        |

---

## 🎞️ Live Preview

>> *Deploy your own in 10 minutes — see the Deployment section below*

| Route | Description |
|---|---|
| `/` | Dashboard — live stats & error trends |
| `/demo` | The monitored demo store (break it on purpose) |
| `/sessions` | All captured sessions |
| `/issues` | Fingerprint-grouped errors |
| `/settings` | SDK install & privacy details |

---

## ✨ Highlights

### 📊 Dashboard
Live aggregates pulled straight from PostgreSQL — total sessions, captured events, open issues, high-severity count, and affected sessions. A 14-day error trend chart with gradient area fill, plus recent sessions and latest issues at a glance.

### 🎬 Session Replay
A chronological event timeline with **play, pause, step-forward, step-back**, and speed toggle. Error rows are marked in red, a synchronized detail panel shows payloads and stack traces, and a scrubber lets you jump anywhere. *Event-based replay — honest about not being pixel-perfect video.*

### 🧬 Issue Grouping
Errors are normalized (line numbers, UUIDs, hex addresses stripped) and fingerprinted with SHA-256 over the message + top stack frames. The same bug across 50 sessions becomes **one issue with a count of 50** — never 50 duplicates.

### 💡 Diagnostic Suggestions
Rule-based hypotheses tied to real evidence — HTTP 500 → check server logs, 401 → inspect auth state, timeout → check availability, TypeError → inspect the call site. Each one **cites the evidence that triggered it**, and all are clearly labelled as hypotheses, not confirmed causes.

### 📈 Anomaly Scoring
A deterministic, transparent score per session based on error count, failed requests, error ratio, and repeat frequency — with a human-readable explanation and documented limitations. No black-box model, no external API.

### 📄 Report Export
One click generates a complete bug report in **JSON or Markdown**, containing reproduction steps derived from actual captured events, occurrence history, supporting evidence, and diagnostic hints. Ready to paste into a ticket.

### 🛡️ Privacy-First SDK
A dependency-free browser SDK that captures clicks, navigation, errors, rejections, console output, and failed fetches — while **never** touching passwords, form values, cookies, auth headers, request bodies, or keystrokes. Bounded queue, bounded retries, self-healing sessions, and a visible stop-recording control.

### 🏪 Controlled Demo Site
"NovaShop" — a fake store wired to the real SDK, with a *Break it on purpose* console: trigger a JavaScript error, a real HTTP 500, a genuine network timeout, a console error, or a custom event. Watch them appear live, then investigate them on the dashboard.

---

## 🎯 Why I Built This

Observability tools are either enterprise-expensive or toy demos. I wanted to prove a full pipeline could be built properly:

- Real data flow — SDK → API → database → UI, with zero fake states
- Privacy by design — not as an afterthought, but as a validation layer
- Honest engineering — heuristics labelled as heuristics, limits documented
- Production habits — validation, idempotency, rate limiting, CORS, transactions

---

## 🏗️ Architecture

```mermaid
flowchart LR
  subgraph Browser
    DEMO[NovaShop Demo Site]
    SDK[BugReplay SDK]
  end
  subgraph Application
    UI[Dashboard · Sessions · Issues]
    API[REST API /api/v1]
    SVC[Fingerprint · Severity · Hints · Anomaly]
  end
  DB[(PostgreSQL)]
  DEMO --> SDK
  SDK -->|POST events| API
  UI -->|fetch| API
  API --> SVC
  API --> DB
```

---

## 📡 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Service + database health |
| `GET` | `/api/v1/stats` | Dashboard aggregates & trends |
| `GET` | `/api/v1/sessions` | List sessions (search, filter, paginate) |
| `POST` | `/api/v1/sessions` | Create a session |
| `GET` | `/api/v1/sessions/:id/events` | Ordered event timeline |
| `POST` | `/api/v1/sessions/:id/events` | Ingest events (validated, idempotent) |
| `GET` | `/api/v1/issues` | List grouped issues |
| `GET` | `/api/v1/issues/:id` | Evidence, occurrences, hints |
| `PATCH` | `/api/v1/issues/:id` | Update status |
| `GET` | `/api/v1/issues/:id/report.md` | Download bug report |
| `POST` | `/api/v1/demo/seed` | Load demo dataset |

---

## 🖥️ Run Locally

To clone and run this project on your local machine:

```bash
git clone https://github.com/YOUR-USERNAME/bugreplay.git

cd bugreplay
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Set your database connection inside `.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@127.0.0.1:5432/app_db
```

Create the tables and start:

```bash
npx drizzle-kit push
npm run dev
```

Open **http://localhost:3000** and click **Load demo data** 🎉

---

## 🐳 Run With Docker

Prefer zero configuration? One command starts PostgreSQL **and** the app:

```bash
docker compose up -d
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `BUGREPLAY_ENV` | ⚠️ Recommended | Set `production` to disable destructive reset |
| `BUGREPLAY_CORS_ORIGINS` | ⬜ Optional | Comma-separated origins for cross-site SDK use |

---

## 🧩 Install the SDK on Your Own Site

```html
<script src="https://your-app.vercel.app/sdk/bugreplay.js"></script>
<script>
  BugReplay.init({
    endpoint: "https://your-app.vercel.app",
    projectId: "demo-project",
    environment: "production"
  });
</script>
```

| Method | Purpose |
|--------|---------|
| `BugReplay.track(name, data)` | Send a custom event |
| `BugReplay.stop()` | Stop recording |
| `BugReplay.start()` | Resume recording |
| `BugReplay.getStatus()` | Inspect live SDK state |

> 💡 Add `data-bugreplay-exclude` to any element to exclude it and its children from capture.

---

## 🔐 Privacy by Design

| ✅ Captured | ❌ Never Captured |
|------------|------------------|
| Click metadata & safe selectors | Passwords & password fields |
| Page navigation events | Form values & typed text |
| JavaScript errors + stack traces | Cookies & auth headers |
| Unhandled promise rejections | Request/response bodies |
| Failed requests (method, status, ms) | Keystrokes |
| Custom events you explicitly send | Sensitive query parameters |

> ⚠️ This is a privacy-aware **design**, not a compliance claim. Real deployments require consent flows, retention policies, and legal review.

---

## 🧪 Testing

```bash
node scripts/selftest.mjs
```

**Result: ✅ 31 passed, 0 failed**

Covers error normalization, fingerprint determinism, severity escalation rules, diagnostic hint matching, anomaly scoring, and privacy sanitizers.

```bash
npm run build      # ✅ production build passes
npm run typecheck  # ✅ zero errors
```

---

## 🚀 Deployment

Deploy free on **Vercel + Neon** in under 10 minutes:

1. 🗄️ Create a PostgreSQL database at [neon.tech](https://neon.tech) and copy the pooled connection string
2. 🔧 Point `drizzle.config.json` at it → run `npx drizzle-kit push` → restore the local URL
3. 📤 Push your code to GitHub
4. ☁️ Import the repo on [vercel.com](https://vercel.com)
5. 🔑 Add env vars: `DATABASE_URL` and `BUGREPLAY_ENV=production`
6. 🎉 Deploy, then verify at `/api/health`

---

## ⚠️ Known Limitations

Honest disclosure — this is an MVP, not an enterprise product:

- 🔓 **No authentication** — do not expose publicly with real user data
- 🎥 Event-based replay only — not pixel-perfect visual playback
- 🌐 Fetch is instrumented; XHR is not
- ⏱️ In-memory rate limiting resets on restart
- 🗑️ No automated data retention enforcement
- 📊 Severity and anomaly scores are transparent heuristics, not measured business impact

---

## 🗺️ Roadmap

- 🔑 Project API keys for authenticated ingestion
- 🌐 XHR interception alongside fetch
- 🧹 Automated retention & data-pruning jobs
- 📧 Alerting on new high-severity issues
- 👥 Multi-project and team support

---

## 📂 Project Structure

```
bugreplay/
├── src/
│   ├── app/              # Pages & API routes
│   ├── components/       # Shared UI components
│   ├── db/               # Drizzle schema & client
│   ├── lib/              # Analysis, ingestion, reports
│   └── middleware.js     # CORS allowlist
├── public/sdk/           # The browser SDK
├── scripts/              # Automated self-tests
├── docs/                 # Architecture, API, testing
└── docker-compose.yml
```

---

## 📜 License

Released under the **MIT License** — free to use, modify, and learn from.

---

<div align="center">

**Built with precision, tested with honesty.** 🐛✨

*BugReplay — because "it works on my machine" isn't a bug report.*

</div>
