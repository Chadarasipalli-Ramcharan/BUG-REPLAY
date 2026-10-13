// Typed-feel browser API client for the BugReplay backend.
// All dashboard data flows through this module.

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function qs(params) {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function request(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    throw new ApiError(
      "Cannot reach the BugReplay backend. Make sure the app server is running.",
      0,
      { cause: String(err) }
    );
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && (data.error || data.detail)) ||
      `Request failed with HTTP ${res.status}`;
    throw new ApiError(message, res.status, data);
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),
  stats: () => request("/api/v1/stats"),

  sessions: (params) => request(`/api/v1/sessions${qs(params)}`),
  session: (id) => request(`/api/v1/sessions/${id}`),
  sessionEvents: (id, params) =>
    request(`/api/v1/sessions/${id}/events${qs(params)}`),

  issues: (params) => request(`/api/v1/issues${qs(params)}`),
  issue: (id) => request(`/api/v1/issues/${id}`),
  updateIssue: (id, status) =>
    request(`/api/v1/issues/${id}`, { method: "PATCH", body: { status } }),

  seed: () => request("/api/v1/demo/seed", { method: "POST" }),
  reset: () => request("/api/v1/demo/reset", { method: "POST" }),

  reportJsonUrl: (id) => `/api/v1/issues/${id}/report`,
  reportMdUrl: (id) => `/api/v1/issues/${id}/report.md`,
};
