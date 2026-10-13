// Pure analysis primitives: normalization, severity rules, diagnostic hints,
// and deterministic session anomaly scoring. No Node or browser imports, so
// the same logic runs in API routes, the self-test script, and the browser.

export const EVENT_TYPES = [
  "session_start",
  "click",
  "navigation",
  "console_error",
  "unhandled_error",
  "network_error",
  "http_error",
  "custom_event",
  "session_end",
];

export const ERROR_TYPES = new Set([
  "console_error",
  "unhandled_error",
  "network_error",
  "http_error",
]);

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes an error message so that the same logical error maps to the
 * same string: collapses whitespace, strips trailing line:column numbers,
 * hex addresses and UUIDs (unstable identifiers).
 */
export function normalizeMessage(msg) {
  let m = String(msg ?? "").replace(/\r\n/g, " ");
  m = m.replace(/\s+/g, " ").trim();
  m = m.replace(/\s*:\s*\d{1,6}(:\d{1,6})?$/g, "");
  m = m.replace(/0x[0-9a-fA-F]{4,}/g, "0xADDR");
  m = m.replace(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    "UUID"
  );
  return m.slice(0, 300);
}

/**
 * Extracts the top N stack frames with line:column numbers, full URLs, and
 * absolute home directories removed, so different machines/minification
 * outputs of the same call chain normalize together.
 */
export function topFrames(stack, n = 3) {
  if (!stack) return [];
  const lines = String(stack)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const frames = [];
  for (const line of lines) {
    let f = line.replace(/^at\s+/, "");
    f = f.replace(/\s*:\d+(:\d+)?\s*$/, "");
    f = f.replace(/\(https?:\/\/[^)]*\)/g, "(url)");
    f = f.replace(/\/Users\/[^/\s()]+/g, "/home/user");
    f = f.replace(/\\Users\\[^/\s()]+/g, "/home/user");
    frames.push(f.slice(0, 160));
    if (frames.length >= n) break;
  }
  return frames;
}

// ---------------------------------------------------------------------------
// Severity rules (transparent heuristics — NOT proof of business impact)
// ---------------------------------------------------------------------------

export const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

/**
 * ctx: { status, reason, occurrenceCount, affectedSessions }
 *
 * Rules (documented in README):
 *  - critical : a 5xx/unhandled error affecting >=4 sessions or seen >=8x
 *  - high     : a 5xx/unhandled error affecting >=2 sessions or seen >=3x
 *  - medium   : first 5xx, unhandled JS error, auth 401/403, network failure
 *  - low      : other 4xx, console errors
 */
export function computeSeverity(kind, ctx = {}) {
  const {
    status,
    reason,
    occurrenceCount = 1,
    affectedSessions = 1,
  } = ctx;

  // Unhandled window errors are classified as "javascript_error"; both are
  // treated as serious application errors for escalation purposes.
  const seriousJs = kind === "unhandled_error" || kind === "javascript_error";

  if ((kind === "http_error" && status >= 500) || seriousJs) {
    if (occurrenceCount >= 8 || affectedSessions >= 4) return "critical";
    if (occurrenceCount >= 3 || affectedSessions >= 2) return "high";
  }
  if (kind === "http_error" && status >= 500) return "medium";
  if (seriousJs) return "medium";
  if (kind === "network_error") return "medium";
  if (kind === "http_error" && (status === 401 || status === 403))
    return "medium";
  if (kind === "http_error") return "low";
  if (kind === "console_error") return "low";
  return "low";
}

// ---------------------------------------------------------------------------
// Root-cause hints — labelled hypotheses, each tied to the evidence that
// triggered it. These are never presented as confirmed root causes.
// ---------------------------------------------------------------------------

export function diagnosticHints(issue) {
  const hints = [];
  const msg = String(issue.message || "").toLowerCase();
  const statusMatch = /HTTP (\d{3})/.exec(issue.message || "");
  const status = statusMatch ? parseInt(statusMatch[1], 10) : null;
  const firstFrame =
    issue.latestStackTrace?.split("\n").map((l) => l.trim()).find(Boolean) ||
    null;

  if (issue.errorType === "http_error" && status >= 500) {
    hints.push({
      id: "http-5xx",
      label: "Server-side failure",
      suggestion:
        `An HTTP ${status} response was observed. Inspect server logs for ` +
        "the corresponding endpoint, recent backend deploys, and database " +
        "or dependency errors at the matching timestamps.",
      evidence: `Observed: HTTP ${status} on ${issue.message}`,
    });
  }
  if (issue.errorType === "http_error" && (status === 401 || status === 403)) {
    hints.push({
      id: "http-auth",
      label: "Authentication / authorization",
      suggestion:
        "Inspect authentication state, session expiry, and authorization " +
        "middleware for this endpoint. The client reached the server but " +
        "was not accepted.",
      evidence: `Observed: HTTP ${status} on ${issue.message}`,
    });
  }
  if (issue.errorType === "http_error" && status === 404) {
    hints.push({
      id: "http-404",
      label: "Missing route or resource",
      suggestion:
        "Verify the requested URL and route configuration. This usually " +
        "means a stale client link, a renamed endpoint, or a missing route.",
      evidence: `Observed: HTTP 404 on ${issue.message}`,
    });
  }
  if (issue.errorType === "http_error" && status && status < 500) {
    hints.push({
      id: "http-4xx",
      label: "Client-side request problem",
      suggestion:
        "Inspect the request payload and client-side validation. The " +
        "server rejected the request before processing it.",
      evidence: `Observed: HTTP ${status} on ${issue.message}`,
    });
  }
  if (issue.errorType === "network_error") {
    if (/timeout|abort/.test(msg)) {
      hints.push({
        id: "net-timeout",
        label: "Request timeout",
        suggestion:
          "Inspect server availability and request duration. A timeout " +
          "means the request never completed in the allowed window — check " +
          "slow queries, blocking handlers, or network latency.",
        evidence: `Observed: network failure (${
          String(issue.message).match(/\([^)]*\)/)?.[0] || "timeout"
        })`,
      });
    } else {
      hints.push({
        id: "net-failure",
        label: "Network connectivity",
        suggestion:
          "Inspect server availability, DNS, and network connectivity for " +
          "the affected users. The request never received a response.",
        evidence: `Observed: ${issue.message}`,
      });
    }
  }
  if (
    (issue.errorType === "javascript_error" ||
      issue.errorType === "unhandled_error") &&
    (/typeerror/i.test(msg) || /cannot read|properties of (undefined|null)/i.test(msg))
  ) {
    hints.push({
      id: "js-typeerror",
      label: "Undefined property access",
      suggestion:
        "Inspect the reported call site and the state of the object being " +
        "read. This is usually an object that was expected to be populated " +
        "but was undefined or null at access time.",
      evidence: firstFrame ? `Top frame: ${firstFrame}` : `Message: ${issue.message}`,
    });
  }
  if (/rejection|promise/i.test(msg)) {
    hints.push({
      id: "js-promise",
      label: "Unhandled promise rejection",
      suggestion:
        "Inspect the asynchronous operation that produced this rejection " +
        "and add or fix a catch handler so the failure path is handled.",
      evidence: `Message: ${issue.message}`,
    });
  }
  if (/referenceerror|is not defined/i.test(msg)) {
    hints.push({
      id: "js-reference",
      label: "Missing symbol",
      suggestion:
        "Inspect the module scope and import graph for the missing symbol. " +
        "This often indicates a bad import, a typo, or a missing dependency.",
      evidence: `Message: ${issue.message}`,
    });
  }
  if (issue.affectedSessionCount > 1) {
    hints.push({
      id: "reproducible",
      label: "Reproduces across sessions",
      suggestion:
        `This error was observed in ${issue.affectedSessionCount} distinct ` +
        "sessions. The behavior is likely deterministic for a given input " +
        "path — replay one of the linked sessions to reproduce.",
      evidence: `Affected sessions: ${issue.affectedSessionCount}`,
    });
  }
  if (issue.occurrenceCount >= 3) {
    hints.push({
      id: "repeated",
      label: "Repeated occurrences",
      suggestion:
        "The same fingerprint has occurred multiple times, which suggests a " +
        "stable code path rather than a transient one-off.",
      evidence: `Occurrences: ${issue.occurrenceCount}`,
    });
  }
  return hints;
}

// ---------------------------------------------------------------------------
// Session anomaly scoring — deterministic, rules-based, no model required.
// Features: error count, failed requests, error ratio, repeated fingerprints.
// ---------------------------------------------------------------------------

export function scoreSessionEvents(eventList) {
  const total = eventList.length;
  const errors = eventList.filter((e) => ERROR_TYPES.has(e.type));
  const netFails = eventList.filter(
    (e) => e.type === "network_error" || e.type === "http_error"
  );

  const byKey = new Map();
  for (const e of errors) {
    const key = e.fingerprint ||
      `${e.type}:${normalizeMessage(e.name || e.payload?.message || "")}`;
    byKey.set(key, (byKey.get(key) || 0) + 1);
  }
  const maxRepeat = byKey.size ? Math.max(...byKey.values()) : 0;
  const errorRatio = total ? errors.length / total : 0;

  const parts = {
    errors: Math.min(40, errors.length * 8),
    netFails: Math.min(25, netFails.length * 5),
    ratio: Math.round(errorRatio * 60),
    repeats: Math.min(10, Math.max(0, maxRepeat - 1) * 5),
  };
  const score = Math.min(100, parts.errors + parts.netFails + parts.ratio + parts.repeats);
  const band = score < 20 ? "low" : score < 45 ? "moderate" : score < 70 ? "high" : "severe";

  const features = {
    totalEvents: total,
    errorCount: errors.length,
    failedRequests: netFails.length,
    errorRatio: Number(errorRatio.toFixed(3)),
    maxRepeatedError: maxRepeat,
  };
  const explanation =
    total === 0
      ? "No events captured for this session."
      : `Anomaly ${score}/100 (band: ${band}). ${errors.length} error event(s) out of ${total}, ` +
        `${netFails.length} failed request(s), error ratio ${features.errorRatio}, ` +
        `most-repeated error seen ${maxRepeat}x. Limitations: this is a transparent ` +
        "rules-based score for triage prioritization, not a fault prediction.";

  return { score, band, features, explanation };
}
