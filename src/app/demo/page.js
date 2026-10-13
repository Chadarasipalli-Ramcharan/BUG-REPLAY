"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Clock,
  FlaskConical,
  MousePointerClick,
  Play,
  ServerCrash,
  Square,
  Terminal,
  Timer,
  WifiOff,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// NovaShop — a controlled "customer website" instrumented with the BugReplay
// SDK. Every interaction below produces REAL events through the SDK and the
// ingestion API; nothing on this page is faked for the dashboard.
// ---------------------------------------------------------------------------

const PRODUCTS = [
  { id: "lamp", name: "Aurora Lamp", price: "$129", brId: "add-cart-lamp" },
  { id: "chair", name: "Nova Chair", price: "$449", brId: "add-cart-chair" },
  { id: "desk", name: "Orbit Desk", price: "$799", brId: "add-cart-desk" },
];

const EVENT_LABELS = {
  session_start: "session start",
  session_end: "session end",
  click: "click",
  navigation: "navigation",
  console_error: "console error",
  unhandled_error: "uncaught error",
  network_error: "network error",
  http_error: "http error",
  custom_event: "custom event",
};

export default function DemoPage() {
  const [tab, setTab] = useState("shop");
  const [sdk, setSdk] = useState(null);
  const [feed, setFeed] = useState([]);
  const [orderResult, setOrderResult] = useState(null);
  const initedRef = useRef(false);
  const unsubscribeRef = useRef(null);

    const initSdk = useCallback(() => {
    const BR = window.BugReplay;
    if (!BR || initedRef.current) return;
    if (!BR.getStatus().active) {
      BR.init({
        endpoint: window.location.origin,
        projectId: "demo-project",
        environment: "development",
      });
    }
    initedRef.current = true;
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = BR.onEvent((ev) =>
      setFeed((prev) => [{ at: new Date(), ...ev }, ...prev].slice(0, 8))
    );
    setSdk(BR.getStatus());
  }, []);

  useEffect(() => {
    initSdk();
    const poll = setInterval(() => {
      if (!initedRef.current) initSdk();
      else if (window.BugReplay) setSdk(window.BugReplay.getStatus());
    }, 700);
    return () => {
      clearInterval(poll);
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [initSdk]);

  function go(next) {
    setTab(next);
    try {
      window.history.pushState({}, "", `#demo-${next}`);
    } catch {
      /* ignore */
    }
  }

  // --- controlled failure triggers (all real) ---
  function triggerJsError() {
    const customer = { id: 42, profile: undefined };
    customer.profile.customerName.toUpperCase(); // uncaught TypeError
  }

  async function triggerHttp500() {
    setOrderResult(null);
    try {
      await fetch("/api/v1/demo/fail?status=500");
    } catch {
      /* the SDK records the 500; original behaviour preserved */
    }
  }

  async function triggerTimeout() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      await fetch("/api/v1/demo/slow", { signal: ctrl.signal });
    } catch {
      /* recorded as network_error (timeout) */
    } finally {
      clearTimeout(t);
    }
  }

  function triggerConsoleError() {
    console.error(
      "PaymentGateway: response malformed — missing field 'total'"
    );
  }

  function trackCustom() {
    window.BugReplay?.track("checkout_started", { items: 3, channel: "web" });
  }

  async function workingOrder() {
    setOrderResult(null);
    try {
      const res = await fetch("/api/v1/demo/ok", { method: "POST" });
      const data = await res.json();
      setOrderResult(data);
    } catch {
      setOrderResult({ ok: false, message: "request failed" });
    }
  }

  const recording = !!sdk?.active;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* ---- site header ---- */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
            N
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">NovaShop</div>
            <div className="text-[10px] text-slate-500">
              demo store · monitored by BugReplay
            </div>
          </div>

          <div
            className={`ml-4 flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
              recording
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                recording ? "animate-pulse bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {recording ? "Recording session" : "Recording stopped"}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {recording ? (
              <button
                onClick={() => window.BugReplay?.stop()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-rose-300 hover:text-rose-600"
              >
                <Square className="h-3 w-3" /> Stop recording
              </button>
            ) : (
              <button
                onClick={() => window.BugReplay?.start()}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
              >
                <Play className="h-3 w-3" /> Resume recording
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
            >
              <ArrowLeft className="h-3 w-3" /> BugReplay dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-5">
        {/* ---- the "store" ---- */}
        <div className="space-y-4 lg:col-span-3">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {["shop", "orders", "account"].map((t) => (
              <button
                key={t}
                onClick={() => go(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "shop" && (
            <div className="grid gap-3 sm:grid-cols-3">
              {PRODUCTS.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3 flex h-20 items-center justify-center rounded-md bg-gradient-to-br from-slate-200 to-slate-300 font-mono text-2xl text-slate-400">
                    {p.id[0].toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mb-3 text-xs text-slate-500">{p.price}</div>
                  <button
                    data-br-id={p.brId}
                    onClick={() =>
                      window.BugReplay?.track("add_to_cart", { product: p.id })
                    }
                    className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                  >
                    Add to cart
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold">Orders</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  data-br-id="place-order"
                  onClick={workingOrder}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                >
                  Place order (works)
                </button>
                <button
                  data-br-id="place-order-500"
                  onClick={triggerHttp500}
                  className="rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500"
                >
                  Place order (server 500)
                </button>
                <button
                  data-br-id="export-report"
                  onClick={triggerTimeout}
                  className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-400"
                >
                  Export report (times out)
                </button>
              </div>
              {orderResult && (
                <p
                  className={`rounded-md px-3 py-2 text-xs font-medium ${
                    orderResult.ok
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {orderResult.ok
                    ? `Order ${orderResult.order} placed — ${orderResult.message}`
                    : orderResult.message}
                </p>
              )}
              <p className="text-[11px] leading-relaxed text-slate-500">
                The 500 and the timeout produce real HTTP/network failures that
                the BugReplay SDK instruments and reports to the dashboard.
              </p>
            </div>
          )}

          {tab === "account" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold">Account</h3>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  Email
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                  <span className="mt-1 block text-[10px] font-normal text-slate-400">
                    Values are never recorded — only that a click happened.
                  </span>
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Password
                  <input
                    type="password"
                    placeholder="••••••••"
                    data-bugreplay-exclude
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </label>
                <button
                  data-br-id="sign-in"
                  className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  Sign in
                </button>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <button
                  data-br-id="load-profile"
                  onClick={triggerJsError}
                  className="rounded-md bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-500"
                >
                  Load customer profile (throws)
                </button>
                <p className="mt-2 text-[11px] text-slate-500">
                  Reproduces the classic “Cannot read properties of undefined
                  (reading &lsquo;customerName&rsquo;)” bug.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              What BugReplay captures on this page
            </h3>
            <ul className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              <li>✓ Clicks (tag + safe selector + label)</li>
              <li>✓ Tab navigation (history.pushState)</li>
              <li>✓ Uncaught JS errors + stack traces</li>
              <li>✓ Failed / slow requests (method, URL, status, ms)</li>
              <li>✓ console.error output</li>
              <li>✓ Custom events (track API)</li>
              <li className="text-rose-600">✗ Form values & passwords</li>
              <li className="text-rose-600">✗ Request/response bodies</li>
            </ul>
          </div>
        </div>

        {/* ---- the "break it" console ---- */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Bug className="h-4 w-4 text-indigo-400" />
                Break it on purpose
              </h3>
              <span className="font-mono text-[10px] text-slate-500">
                {sdk ? `v${sdk.version}` : "loading…"}
              </span>
            </div>
            <div className="grid gap-2">
              <TriggerButton
                icon={AlertTriangle}
                label="Trigger JavaScript error"
                hint="uncaught TypeError"
                onClick={triggerJsError}
              />
              <TriggerButton
                icon={ServerCrash}
                label="Trigger failing API request"
                hint="real HTTP 500"
                onClick={triggerHttp500}
              />
              <TriggerButton
                icon={Timer}
                label="Trigger network timeout"
                hint="aborts after 2.5s"
                onClick={triggerTimeout}
              />
              <TriggerButton
                icon={Terminal}
                label="Log a console error"
                hint="console.error"
                onClick={triggerConsoleError}
              />
              <TriggerButton
                icon={Zap}
                label="Send a custom event"
                hint="track(checkout_started)"
                onClick={trackCustom}
              />
            </div>

            <div className="mt-4 rounded-md border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5" /> SDK status
                </span>
                <span
                  className={`font-mono ${recording ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {recording ? "active" : "stopped"}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-slate-500">
                <dt>session</dt>
                <dd className="truncate text-slate-300">
                  {sdk?.sessionId ? sdk.sessionId.slice(0, 8) + "…" : "—"}
                </dd>
                <dt>captured</dt>
                <dd className="text-slate-300">{sdk?.captured ?? 0}</dd>
                <dt>in queue</dt>
                <dd className="text-slate-300">{sdk?.queued ?? 0}</dd>
                <dt>dropped</dt>
                <dd className="text-slate-300">{sdk?.dropped ?? 0}</dd>
              </dl>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-slate-100">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Clock className="h-3.5 w-3.5" /> Live capture feed
            </h3>
            {feed.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-600">
                Interact with the store to see captured events…
              </p>
            ) : (
              <ul className="space-y-1.5">
                {feed.map((ev, i) => {
                  const isErr = [
                    "console_error",
                    "unhandled_error",
                    "network_error",
                    "http_error",
                  ].includes(ev.type);
                  return (
                    <li
                      key={`${i}-${ev.type}`}
                      className={`rounded-md border px-2.5 py-1.5 ${
                        isErr
                          ? "border-rose-900/60 bg-rose-950/40"
                          : "border-slate-800 bg-slate-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {ev.type === "click" ? (
                          <MousePointerClick className="h-3 w-3 text-indigo-400" />
                        ) : isErr ? (
                          ev.type === "network_error" ? (
                            <WifiOff className="h-3 w-3 text-rose-400" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-rose-400" />
                          )
                        ) : (
                          <Zap className="h-3 w-3 text-slate-500" />
                        )}
                        <span
                          className={`font-mono text-[10px] uppercase ${
                            isErr ? "text-rose-400" : "text-slate-500"
                          }`}
                        >
                          {EVENT_LABELS[ev.type] || ev.type}
                        </span>
                        <span className="ml-auto font-mono text-[9px] text-slate-600">
                          {ev.at.toISOString().slice(11, 19)}
                        </span>
                      </div>
                      {(ev.name || ev.selector) && (
                        <p className="mt-0.5 truncate pl-5 text-[11px] text-slate-300">
                          {ev.name || ev.selector}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-slate-500">
            Everything above flows through the real ingestion API into
            PostgreSQL, then into the BugReplay dashboard. Open the dashboard
            after triggering something to inspect the session timeline and
            grouped issues.
          </p>
        </div>
            </main>

      <Script
        src="/sdk/bugreplay.js"
        strategy="afterInteractive"
        onLoad={() => initSdk()}
      />
    </div>
  );
}

function TriggerButton({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition-colors hover:border-rose-800 hover:bg-rose-950/30"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-rose-400" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-200">
          {label}
        </span>
        <span className="block font-mono text-[10px] text-slate-500">
          {hint}
        </span>
      </span>
    </button>
  );
}
