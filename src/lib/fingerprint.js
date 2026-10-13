// Server-only: deterministic error fingerprinting and event classification.

import { createHash } from "node:crypto";
import { normalizeMessage, topFrames } from "./analysis.js";
import { sanitizeStack } from "./sanitize.js";

function onlyPath(url) {
  if (!url) return "/";
  try {
    const u = new URL(url, "http://fp.local");
    return u.pathname.slice(0, 120);
  } catch {
    return String(url).split("?")[0].slice(0, 120);
  }
}

/**
 * Deterministic fingerprint over normalized (error kind, message, top frames).
 * Line/column numbers and unstable identifiers are removed first, so the same
 * logical error produces the same fingerprint, while materially different
 * errors stay distinct.
 */
export function fingerprintFor(kind, message, stack) {
  const norm = normalizeMessage(message);
  const frames = topFrames(stack, 3).join("\u0000");
  const raw = `${kind}\u0000${norm}\u0000${frames}`;
  return "fp_" + createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 24);
}

/**
 * Maps a validated, non-error-free event onto an issue "kind".
 * Returns null for events that do not create issues (clicks, navigation...).
 */
export function classifyEvent(ev) {
  const p = ev.payload || {};
  switch (ev.type) {
    case "unhandled_error":
      return {
        kind: "javascript_error",
        message: String(p.message || ev.name || "Uncaught error").slice(0, 300),
        stack: p.stack ? String(p.stack) : null,
        status: null,
        reason: null,
      };
    case "console_error":
      return {
        kind: "console_error",
        message: String(p.message || ev.name || "console.error()").slice(0, 300),
        stack: null,
        status: null,
        reason: null,
      };
    case "http_error": {
      const status = Number.isFinite(p.status) ? p.status : 0;
      return {
        kind: "http_error",
        message: `HTTP ${status || "?"} ${p.method || "GET"} ${onlyPath(p.url)}`,
        stack: null,
        status: status || null,
        reason: null,
      };
    }
    case "network_error":
      return {
        kind: "network_error",
        message: `Network failure (${p.reason || "unknown"}) ${p.method || "GET"} ${onlyPath(p.url)}`,
        stack: null,
        status: null,
        reason: p.reason || null,
      };
    default:
      return null;
  }
}

export function issueTitleFor(cls) {
  const base = normalizeMessage(cls.message);
  if (cls.kind === "http_error") return `HTTP error: ${base}`;
  if (cls.kind === "network_error") return `Network failure: ${base.slice(0, 90)}`;
  if (cls.kind === "console_error") return `Console error: ${base.slice(0, 90)}`;
  return base.slice(0, 100) || "JavaScript error";
}

export { sanitizeStack };
