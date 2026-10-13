// Pure, privacy-focused sanitizers. No Node imports — safe on server and client.

const SENSITIVE_KEY =
  /(token|secret|password|passwd|pwd|auth|api[_-]?key|access[_-]?key|session[_-]?id|ssn|credit|card[_-]?number|cookie|authorization|jwt|refresh)/i;

const MAX_URL = 500;
const MAX_STACK = 4000;

export function truncate(value, max) {
  const s = String(value ?? "");
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Removes sensitive query parameters and the fragment from a URL.
 * Accepts absolute or root-relative URLs.
 */
export function sanitizeUrl(raw) {
  if (!raw) return "/";
  const input = String(raw);
  try {
    const u = new URL(input, "http://sanitize.local");
    const kept = new URLSearchParams();
    for (const [key, value] of u.searchParams.entries()) {
      if (!SENSITIVE_KEY.test(key)) kept.set(key, value);
    }
    const qs = kept.toString();
    const isRelative =
      input.startsWith("/") || input === "" || input.startsWith("#");
    const base = isRelative ? "" : `${u.protocol}//${u.host}`;
    const out = `${base}${u.pathname}${qs ? `?${qs}` : ""}`;
    return truncate(out || "/", MAX_URL);
  } catch {
    return truncate(input.split("#")[0], MAX_URL);
  }
}

/**
 * Trims a stack trace: caps length, strips query strings from frame URLs and
 * collapses runs of whitespace. Does not attempt to "fix" code.
 */
export function sanitizeStack(raw) {
  if (!raw) return null;
  let out = String(raw).replace(/\s+/g, " ").replace(/\s+/g, " ");
  out = out.replace(/\(\s*(https?:\/\/[^)\s?]+)[^)]*\)/g, "($1)");
  return truncate(out, MAX_STACK);
}

/**
 * Recursively removes values for sensitive keys from a payload object.
 * Returns a new object; the input is never mutated.
 */
export function scrubPayload(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(scrubPayload);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[redacted]";
      } else if (typeof v === "string" && v.length > 2000) {
        out[k] = truncate(v, 2000);
      } else {
        out[k] = scrubPayload(v);
      }
    }
    return out;
  }
  if (typeof value === "string") return truncate(value, 2000);
  return value;
}
