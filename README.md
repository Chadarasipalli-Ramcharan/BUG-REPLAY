## 🐛 BUGREPLAY — THE TIME MACHINE FOR SOFTWARE BUGS

>Welcome to **BugReplay** — a browser-session debugging platform that turns vague bug reports into **hard evidence**. Built for developers who are tired of hearing *"the login button doesn't work"* with zero context. This isn't just a dashboard — it's a **full observability pipeline**: a privacy-first browser SDK, a real ingestion API, deterministic error grouping, and exportable investigation reports.

---

## 💼 About the Project

Developers lose hours reproducing bugs they can't see. BugReplay solves this by capturing **what the user actually did** — every click, navigation, JavaScript error, and failed network request — then grouping repeated errors into issues, scoring sessions for anomalies, and generating evidence-backed bug reports.

From a controlled demo website → through a real SDK → into PostgreSQL → onto an investigation dashboard. Every number you see is read from the database. Nothing is faked.

---

## 🛠️ Core Technologies

### 🎨 Frontend & Styling

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,nextjs,js,tailwind&perline=4" alt="Frontend Technologies"/>
</p>

<p align="center">
  <b>React 19</b> • <b>Next.js 16</b> • <b>JavaScript</b> • <b>Tailwind CSS v4</b>
</p>

---

### 🧩 UI & Visualization

<p align="center">
  <img src="https://cdn.simpleicons.org/recharts/22B5BF" width="45" alt="Recharts"/>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/lucide/F56565" width="45" alt="Lucide Icons"/>
</p>

<p align="center">
  <b>Recharts</b> • <b>Lucide Icons</b> • <b>Custom Replay Controls</b>
</p>

---

### ⚙️ Backend & Database

<p align="center">
  <img src="https://skillicons.dev/icons?i=postgres&perline=1" alt="PostgreSQL"/>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/drizzle/C5F74F" width="45" alt="Drizzle ORM"/>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="https://cdn.simpleicons.org/nextdotjs/FFFFFF" width="45" alt="Next.js"/>
</p>

<p align="center">
  <b>Next.js Route Handlers</b> • <b>REST API (/api/v1)</b>
</p>

<p align="center">
  <b>PostgreSQL</b> • <b>Drizzle ORM</b> • <b>Neon</b>
</p>

---

### 🔍 Analysis & Testing

<p align="center">
  <img src="https://img.shields.io/badge/SHA--256-Fingerprinting-4B5563?style=for-the-badge" alt="SHA-256 Fingerprinting"/>
  &nbsp;
  <img src="https://img.shields.io/badge/Rule--Based-Diagnostics-7C3AED?style=for-the-badge" alt="Rule-Based Diagnostics"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Self--Tests-31%20Assertions-2EA44F?style=for-the-badge" alt="31 Test Assertions"/>
</p>

---

### 🐳 DevOps & Deployment

<p align="center">
  <img src="https://skillicons.dev/icons?i=docker,vercel,git,github&perline=4" alt="DevOps Technologies"/>
</p>

<p align="center">
  <b>Docker</b> • <b>Docker Compose</b> • <b>Vercel</b> • <b>Neon</b>
</p>

---

### 🌐 Browser SDK

<p align="center">
  <img src="https://img.shields.io/badge/Vanilla_JavaScript-Zero_Dependencies-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JavaScript SDK"/>
</p>

---

### 🧰 Version Control

<p align="center">
  <img src="https://skillicons.dev/icons?i=git,github&perline=2" alt="Git and GitHub"/>
</p>

<p align="center">
  <b>Git</b> • <b>GitHub</b>
</p>

---

<p align="center">
  <i>Built with modern web technologies, structured diagnostics, and automated testing.</i>
</p>

---

## 🎞️ Live Preview

> https://bug-replay.vercel.app/


| Route | Description |
|---|---|
| `/` | Dashboard — live stats & error trends |
| `/demo` | The monitored demo store (break it on purpose) |
| `/sessions` | All captured sessions |
| `/issues` | Fingerprint-grouped errors |
| `/settings` | SDK install & privacy details |

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
