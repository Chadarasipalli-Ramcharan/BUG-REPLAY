import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, DEMO_PROJECT_SLUG, DEMO_PROJECT_ID } from "@/db/schema";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function jsonError(status, message, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

export function clamp(n, min, max) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : min;
}

export async function readJson(req, limitBytes = 256 * 1024) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > limitBytes) {
    throw new HttpError(413, `Request body too large (max ${limitBytes} bytes)`);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  if (body === null || typeof body !== "object") {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return body;
}

export function handleError(e) {
  if (e instanceof HttpError) {
    return jsonError(e.status, e.message);
  }
  if (e?.code === "23505") {
    return jsonError(409, "Resource already exists");
  }
  const errText = `${e?.message || ""} ${e?.cause?.message || ""}`;
  if (/invalid input syntax for type uuid|invalid uuid/i.test(errText)) {
    return jsonError(404, "Resource not found");
  }
  console.error("[bugreplay] unhandled API error:", e);
  return jsonError(500, "Internal server error");
}

/**
 * Resolves a project by slug, creating the default demo project on demand.
 */
export async function getOrCreateProject(slug = DEMO_PROJECT_SLUG) {
  const safeSlug = String(slug || DEMO_PROJECT_SLUG).slice(0, 64);
  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, safeSlug))
    .limit(1);
  if (existing) return existing;
  const isDemo = safeSlug === DEMO_PROJECT_SLUG;
  const [created] = await db
    .insert(projects)
    .values({
      ...(isDemo ? { id: DEMO_PROJECT_ID } : {}),
      slug: safeSlug,
      name: isDemo ? "Demo project" : safeSlug,
    })
    .onConflictDoNothing({ target: projects.slug })
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, safeSlug))
    .limit(1);
  return again;
}
