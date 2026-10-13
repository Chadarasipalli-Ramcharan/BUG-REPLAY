/*!
 * BugReplay browser SDK v0.1.0
 * Privacy-conscious session & error capture.
 *
 * Captures: session lifecycle, click metadata (never form values), page
 * navigation, window errors, unhandled promise rejections, console.error,
 * failed fetch requests (method, sanitized URL, duration, status).
 *
 * NEVER captures: password fields or values, form values, typed text,
 * cookies, auth headers, request/response bodies, keystrokes, private
 * query params, fragments.
 *
 * Exclude any element (and its subtree) with:  data-bugreplay-exclude
 *
 * Usage:
 *   BugReplay.init({
 *     endpoint: "http://localhost:3000",
 *     projectId: "demo-project",
 *     environment: "development",
 *   });
 *   BugReplay.track("custom_event_name", { safe: "payload" });
 *   BugReplay.stop();
 *   BugReplay.getStatus();
 *   BugReplay.onEvent(cb);
 */
(function (global) {
  "use strict";
  if (global.BugReplay && global.BugReplay.__version) return;

  const VERSION = "0.1.0";
  const MAX_QUEUE = 200;
  const MAX_BATCH = 50;
  const FLUSH_INTERVAL_MS = 2000;
  const MAX_RETRIES = 2;
  const MAX_PAYLOAD_CHARS = 8000;
  const MAX_NAME = 200;
  const MAX_SEL = 200;
  const MAX_URL = 500;
  const SENSITIVE_KEY =
    /(token|secret|password|passwd|pwd|auth|api[_-]?key|access[_-]?key|ssn|credit|card|cookie|authorization|jwt)/i;

  const state = {
    active: false,
    initializing: false,
    config: null,
    endpoint: "",
    projectId: "demo-project",
    environment: "development",
    debug: false,
    sessionId: null,
    queue: [],
    seq: 0,
    captured: 0,
    dropped: 0,
    failedBatches: 0,
    timer: null,
        sessionEndSent: false,
    lastSessionAttempt: 0,
    listeners: [],
    eventListeners: [],
    sending: false,
    recovering: false,
    recoveries: 0,
  };
  function log(...args) {
    if (state.debug) {
      try {
        console.debug("[BugReplay]", ...args);
      } catch (e) {}
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function base() {
    return state.endpoint.replace(/\/+$/, "");
  }

  // ---------------- privacy helpers ----------------

  function truncate(s, n) {
    const v = String(s ?? "");
    return v.length > n ? v.slice(0, n) : v;
  }

  function sanitizeUrl(raw) {
    if (!raw) return "/";
    const input = String(raw);
    try {
      const u = new URL(input, "http://sanitize.local");
      const kept = new URLSearchParams();
      for (const pair of u.searchParams.entries()) {
        if (!SENSITIVE_KEY.test(pair[0])) kept.set(pair[0], pair[1]);
      }
      const qs = kept.toString();
      const relative =
        input.startsWith("/") || input === "" || input.startsWith("#");
      const out = `${relative ? "" : u.protocol + "//" + u.host}${u.pathname}${
        qs ? "?" + qs : ""
      }`;
      return truncate(out || "/", MAX_URL);
    } catch (e) {
      return truncate(input.split("#")[0], MAX_URL);
    }
  }

  function scrubValue(v) {
    if (Array.isArray(v)) return v.slice(0, 50).map(scrubValue);
    if (v && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v)) {
        if (SENSITIVE_KEY.test(k)) out[k] = "[redacted]";
        else if (typeof v[k] === "string" && v[k].length > 2000)
          out[k] = truncate(v[k], 2000);
        else out[k] = scrubValue(v[k]);
      }
      return out;
    }
    if (typeof v === "string") return truncate(v, 2000);
    return v;
  }

  function currentUrl() {
    try {
      return sanitizeUrl(global.location ? global.location.href : "/");
    } catch (e) {
      return "/";
    }
  }

  function perfNow() {
    try {
      return global.performance && performance.now ? performance.now() : Date.now();
    } catch (e) {
      return Date.now();
    }
  }

  function cleanAttr(v) {
    return String(v).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  }

  function safeSelector(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      if (el.hasAttribute && el.hasAttribute("data-bugreplay-exclude"))
        return null;
      if (el.closest && el.closest("[data-bugreplay-exclude]")) return null;
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (!tag || tag === "script" || tag === "style" || tag === "head")
        return null;
      let attr = "";
      const brId =
        el.getAttribute &&
        (el.getAttribute("data-br-id") || el.getAttribute("data-testid"));
      if (brId) attr = `[data-br-id="${cleanAttr(brId)}"]`;
      else if (el.id) attr = `#${cleanAttr(el.id)}`;
      else if (el.getAttribute && el.getAttribute("aria-label"))
        attr = `[label="${cleanAttr(el.getAttribute("aria-label"))}"]`;
      else if (el.className && typeof el.className === "string") {
        const cls = el.className
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map(cleanAttr)
          .filter(Boolean);
        if (cls.length) attr = "." + cls.join(".");
      }
      return truncate(tag + attr, MAX_SEL);
    } catch (e) {
      return null;
    }
  }

  function describeTarget(el) {
    try {
      if (!el || el.nodeType !== 1) return null;
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      const isButtonish =
        tag === "button" ||
        tag === "a" ||
        tag === "summary" ||
        tag === "label" ||
        (el.getAttribute && el.getAttribute("role") === "button");
      if (isButtonish) {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text) return truncate(text, MAX_NAME);
      }
      if (tag === "input") {
        const type = (el.type || "text").toLowerCase();
        if (type === "password")
          return "Password field (value never captured)";
        if (el.name || el.id) return `Input ${el.name || el.id}`;
        return "Input field";
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function browserInfo() {
    try {
      const ua =
        global.navigator && global.navigator.userAgent
          ? global.navigator.userAgent
          : "";
      let name = "Unknown";
      let version = null;
      let m = ua.match(/Edg(e|A|iOS)?\/([\d.]+)/);
      if (m) {
        name = "Edge";
        version = m[2];
      } else if ((m = ua.match(/Firefox\/([\d.]+)/))) {
        name = "Firefox";
        version = m[1];
      } else if ((m = ua.match(/(Chrome|CriOS)\/([\d.]+)/))) {
        name = "Chrome";
        version = m[2];
      } else if (/Safari/.test(ua) && (m = ua.match(/Version\/([\d.]+)/))) {
        name = "Safari";
        version = m[1];
      }
      let os = null;
      if (/Windows/.test(ua)) os = "Windows";
      else if (/Android/.test(ua)) os = "Android";
      else if (/iPhone|iPad/i.test(ua)) os = "iOS";
      else if (/Mac OS X/.test(ua)) os = "macOS";
      else if (/Linux/.test(ua)) os = "Linux";
      const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
      return { name, version, os, device };
    } catch (e) {
      return { name: null, version: null, os: null, device: null };
    }
  }

  // ---------------- capture pipeline ----------------

  function makeEvent(type, extra) {
    extra = extra || {};
    state.seq += 1;
    const ev = {
      type: type,
      timestamp: new Date().toISOString(),
      pageUrl: extra.pageUrl || currentUrl(),
      idempotencyKey: `br-${(state.sessionId || "pre").slice(0, 8)}-${state.seq}`,
    };
    if (extra.name != null) ev.name = truncate(extra.name, MAX_NAME);
    if (extra.selector != null) ev.selector = truncate(extra.selector, MAX_SEL);
    if (extra.payload != null) {
      const scrubbed = scrubValue(extra.payload);
      try {
        if (JSON.stringify(scrubbed).length > MAX_PAYLOAD_CHARS)
          ev.payload = {};
        else ev.payload = scrubbed;
      } catch (e) {
        ev.payload = {};
      }
    }
    return ev;
  }

  function notifyEventListeners(ev) {
    for (const cb of state.eventListeners) {
      try {
        cb(ev);
      } catch (e) {}
    }
  }

  function capture(ev) {
    state.captured += 1;
    notifyEventListeners(ev);
    if (!state.active) return;
    if (state.queue.length >= MAX_QUEUE) {
      state.queue.shift();
      state.dropped += 1;
    }
    state.queue.push(ev);
    log("captured", ev.type, ev.name || "");
    scheduleFlush();
  }

  function scheduleFlush() {
    if (!state.timer && state.active) {
      state.timer = setTimeout(function () {
        state.timer = null;
        flush().catch(() => {});
      }, FLUSH_INTERVAL_MS);
    }
  }

  function isOwnUrl(url) {
    return !!url && url.indexOf("/api/v1/sessions") !== -1;
  }

   /**
   * Transparently starts a new session when the server no longer knows the
   * current one (database reset, demo reset, fresh DB, stale tab). Bounded so
   * a permanently broken backend can never cause an infinite loop.
   */
  async function recoverSession() {
    if (state.recovering || state.recoveries >= 5) return;
    state.recovering = true;
    state.recoveries += 1;
    try {
      state.sessionId = null;
      state.sessionEndSent = false;
      await createSession();
      log("recovered with a new session", state.sessionId);
    } finally {
      state.recovering = false;
    }
  }

  async function flush(force) {
    if (!state.queue.length) return;
    if (!state.active && !force) return;
    if (!state.sessionId) {
      await recoverSession();
      if (!state.sessionId) return;
    }
    const batch = state.queue.splice(0, MAX_BATCH);
    const url = `${base()}/api/v1/sessions/${state.sessionId}/events`;
    let ok = false;
    for (let attempt = 0; attempt <= MAX_RETRIES && !ok; attempt += 1) {
      state.sending = true;
      let staleSession = false;
      try {
        const res = await global.fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
        });
        ok = res.ok;
        staleSession = res.status === 404;
      } catch (e) {
        ok = false;
      } finally {
        state.sending = false;
      }
      if (staleSession) {
        // Put the events back at the front of the queue, then start a new
        // session so capture continues instead of dying silently.
        state.queue = batch.concat(state.queue).slice(0, MAX_QUEUE);
        await recoverSession();
        scheduleFlush();
        return;
      }
      if (!ok && attempt < MAX_RETRIES) await sleep(700 * (attempt + 1));
    }
    if (!ok) {
      state.failedBatches += 1;
      state.dropped += batch.length;
      log("batch dropped after retries", batch.length);
    }
    scheduleFlush();
  }

  async function createSession() {
    const info = browserInfo();
    const url = `${base()}/api/v1/sessions`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      state.sending = true;
      try {
        const res = await global.fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: state.projectId,
            environment: state.environment,
            pageUrl: currentUrl(),
            browserName: info.name,
            browserVersion: info.version,
            osName: info.os,
            deviceType: info.device,
          }),
          keepalive: true,
        });
        if (res.ok) {
          const data = await res.json();
          state.sessionId = data.session && data.session.id;
          log("session created", state.sessionId);
          capture(makeEvent("session_start", { name: "Session started" }));
          return true;
        }
      } catch (e) {} finally {
        state.sending = false;
      }
      await sleep(1000 * (attempt + 1));
    }
    log("backend unreachable — events buffer locally (bounded)");
    return false;
  }

  // ---------------- instrumentation ----------------

  function on(target, type, fn, useCapture) {
    try {
      target.addEventListener(type, fn, useCapture);
      state.listeners.push({ target, type, fn, capture: useCapture });
    } catch (e) {}
  }

  function onClick(e) {
    try {
      if (!state.active || !e || !e.target) return;
      const el = e.target;
      const interactive =
        (el.closest &&
          el.closest(
            "button, a, [role='button'], input, select, textarea, label, summary"
          )) ||
        el;
      const sel = safeSelector(interactive);
      if (!sel) return;
      capture(
        makeEvent("click", {
          name: describeTarget(interactive) || null,
          selector: sel,
          payload: {
            x: Number.isFinite(e.clientX) ? Math.round(e.clientX) : null,
            y: Number.isFinite(e.clientY) ? Math.round(e.clientY) : null,
          },
        })
      );
    } catch (err) {}
  }

  function onWindowError(e) {
    try {
      if (!state.active) return;
      const file = e.filename ? String(e.filename) : "";
      if (file.indexOf("bugreplay") !== -1) return;
      const errObj = e.error || null;
      const message =
        errObj && errObj.message
          ? `${errObj.name || "Error"}: ${errObj.message}`
          : String(e.message || "Uncaught error");
      capture(
        makeEvent("unhandled_error", {
          name: message,
          selector: null,
          payload: {
            message: message,
            stack: errObj && errObj.stack ? errObj.stack : null,
            line: e.lineno || null,
            column: e.colno || null,
          },
        })
      );
    } catch (err) {}
  }

  function onRejection(e) {
    try {
      if (!state.active) return;
      const r = e.reason;
      let message;
      let stack = null;
      if (r instanceof Error) {
        message = `${r.name}: ${r.message}`;
        stack = r.stack;
      } else if (typeof r === "string") {
        message = r;
      } else {
        try {
          message = JSON.stringify(r);
        } catch (err2) {
          message = String(r);
        }
      }
      capture(
        makeEvent("unhandled_error", {
          name: `Unhandled rejection: ${truncate(message, 200)}`,
          selector: null,
          payload: {
            message: truncate(message, 300),
            stack: stack,
            reason: "unhandledrejection",
          },
        })
      );
    } catch (err) {}
  }

  function onPopState() {
    try {
      if (!state.active) return;
      capture(makeEvent("navigation", { name: "popstate" }));
    } catch (e) {}
  }

  function onPageHide() {
    try {
      if (state.active && !state.sessionEndSent) {
        state.sessionEndSent = true;
        state.queue.push(makeEvent("session_end", { name: "Page hidden" }));
        flush(true).catch(() => {});
      }
    } catch (e) {}
  }

  function wrapHistory() {
    try {
      if (global.history && !global.history.__brPushState) {
        const origPush = global.history.pushState.bind(global.history);
        const push = function (s, t, u) {
          const result = origPush(s, t, u);
          setTimeout(() => {
            try {
              capture(makeEvent("navigation", { name: "pushState" }));
            } catch (e) {}
          }, 0);
          return result;
        };
        push.__brWrapped = true;
        global.history.__brPushState = origPush;
        global.history.pushState = push;

        const origReplace = global.history.replaceState.bind(global.history);
        const replace = function (s, t, u) {
          const result = origReplace(s, t, u);
          setTimeout(() => {
            try {
              capture(makeEvent("navigation", { name: "replaceState" }));
            } catch (e) {}
          }, 0);
          return result;
        };
        replace.__brWrapped = true;
        global.history.__brReplaceState = origReplace;
        global.history.replaceState = replace;
      }
    } catch (e) {}
  }

  function wrapFetch() {
    try {
      const orig = global.fetch;
      if (!orig || orig.__brWrapped) return;
      const wrapped = function (input, init) {
        const url =
          typeof input === "string" ? input : (input && input.url) || "";
        const method =
          ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        const start = perfNow();
        if (state.sending || isOwnUrl(url)) return orig.apply(this, arguments);
        const p = orig.apply(this, arguments);
        try {
          p.then(
            function (res) {
              try {
                if (!res.ok && state.active) {
                  capture(
                    makeEvent("http_error", {
                      name: `${method} ${sanitizeUrl(url)} returned ${res.status}`,
                      selector: null,
                      payload: {
                        url: sanitizeUrl(url),
                        method: method,
                        status: res.status,
                        durationMs: Math.round(perfNow() - start),
                      },
                    })
                  );
                }
              } catch (e) {}
            },
            function (err) {
              try {
                if (state.active) {
                  capture(
                    makeEvent("network_error", {
                      name: `${method} ${sanitizeUrl(url)} failed (${
                        (err && err.name) || "network"
                      })`,
                      selector: null,
                      payload: {
                        url: sanitizeUrl(url),
                        method: method,
                        reason:
                          err && err.name === "AbortError" ? "timeout" : "network",
                        durationMs: Math.round(perfNow() - start),
                      },
                    })
                  );
                }
              } catch (e) {}
            }
          );
        } catch (e) {}
        return p;
      };
      wrapped.__brWrapped = true;
      global.__brFetch = orig;
      global.fetch = wrapped;
    } catch (e) {}
  }

  function safeStringify(v) {
    try {
      if (typeof v === "string") return v;
      if (v instanceof Error) return `${v.name}: ${v.message}`;
      const s = JSON.stringify(v);
      return s ? s.slice(0, 300) : String(v).slice(0, 300);
    } catch (e) {
      return String(v).slice(0, 300);
    }
  }

  function wrapConsole() {
    try {
      if (global.console && global.console.error && !global.console.error.__brWrapped) {
        const orig = global.console.error.bind(global.console);
        const wrapped = function () {
          const args = Array.prototype.slice.call(arguments);
          try {
            if (state.active) {
              const parts = args.map(safeStringify).filter(Boolean);
              const message = truncate(parts.join(" | "), 500);
              if (message) {
                capture(
                  makeEvent("console_error", {
                    name: message,
                    selector: null,
                    payload: { message: message },
                  })
                );
              }
            }
          } catch (e) {}
          return orig.apply(null, args);
        };
        wrapped.__brWrapped = true;
        global.console.__brError = orig;
        global.console.error = wrapped;
      }
    } catch (e) {}
  }

  function attach() {
    if (state.listeners.length) return;
    const w = global;
    on(document, "click", onClick, true);
    on(w, "error", onWindowError, true);
    on(w, "unhandledrejection", onRejection, false);
    on(w, "popstate", onPopState, false);
    on(w, "pagehide", onPageHide, false);
    wrapHistory();
    wrapFetch();
    wrapConsole();
  }

  function detach() {
    for (const l of state.listeners) {
      try {
        l.target.removeEventListener(l.type, l.fn, l.capture);
      } catch (e) {}
    }
    state.listeners = [];
    try {
      const w = global;
      if (w.history && w.history.__brPushState) {
        w.history.pushState = w.history.__brPushState;
        w.history.__brPushState = null;
      }
      if (w.history && w.history.__brReplaceState) {
        w.history.replaceState = w.history.__brReplaceState;
        w.history.__brReplaceState = null;
      }
      if (w.fetch && w.fetch.__brWrapped && w.__brFetch) {
        w.fetch = w.__brFetch;
        w.__brFetch = null;
      }
      if (w.console && w.console.error.__brWrapped && w.console.__brError) {
        w.console.error = w.console.__brError;
        w.console.__brError = null;
      }
    } catch (e) {}
  }

  // ---------------- public API ----------------

  function getStatus() {
    return {
      active: state.active,
      sessionId: state.sessionId,
      queued: state.queue.length,
      captured: state.captured,
      dropped: state.dropped,
      failedBatches: state.failedBatches,
      endpoint: state.endpoint,
      projectId: state.projectId,
      environment: state.environment,
      version: VERSION,
    };
  }

  function init(config) {
    config = config || {};
    if (state.active || state.initializing) return getStatus();
    state.initializing = true;
    state.config = config;
    state.endpoint = String(
      config.endpoint || (global.location ? global.location.origin : "")
    );
    state.projectId = config.projectId || "demo-project";
    state.environment = ["development", "staging", "production"].includes(
      config.environment
    )
      ? config.environment
      : "development";
    state.debug = !!config.debug;
    attach();
    state.active = true;
    state.sessionEndSent = false;
    state.lastSessionAttempt = Date.now();
    log("initialized", getStatus());
    createSession().catch(() => {});
    const interval = setInterval(() => {
      if (state.active) flush().catch(() => {});
    }, 8000);
    if (interval.unref) interval.unref();
    state.timer = state.timer || interval;
    state.initializing = false;
    return getStatus();
  }

  function start() {
    if (state.active) return getStatus();
    state.queue = [];
    state.seq = 0;
    state.sessionId = null;
    state.sessionEndSent = false;
        state.captured = 0;
    state.dropped = 0;
    state.failedBatches = 0;
    state.recoveries = 0;
    state.recovering = false;
    return init(state.config || {});
  }

  function stop() {
    if (!state.active) return getStatus();
    if (state.sessionId && !state.sessionEndSent) {
      state.sessionEndSent = true;
      state.queue.push(makeEvent("session_end", { name: "Recording stopped" }));
    }
    state.active = false;
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    detach();
    flush(true).catch(() => {});
    log("stopped");
    return getStatus();
  }

  function track(name, payload) {
    try {
      capture(
        makeEvent("custom_event", {
          name: String(name).slice(0, 200),
          payload: payload && typeof payload === "object" ? payload : { value: payload },
        })
      );
    } catch (e) {}
    return getStatus();
  }

  function onEvent(cb) {
    if (typeof cb === "function") state.eventListeners.push(cb);
    return function unsubscribe() {
      const i = state.eventListeners.indexOf(cb);
      if (i >= 0) state.eventListeners.splice(i, 1);
    };
  }

  global.BugReplay = {
    __version: VERSION,
    init: init,
    start: start,
    stop: stop,
    track: track,
    onEvent: onEvent,
    getStatus: getStatus,
  };
})(typeof window !== "undefined" ? window : this);
