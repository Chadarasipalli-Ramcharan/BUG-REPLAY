// Session + event ingestion pipeline with validation, idempotency, and
// issue fingerprinting/aggregation. Server-only (uses the Drizzle client).

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  sessions,
  events,
  issues,
  issueOccurrences,
  DEMO_PROJECT_SLUG,
} from "@/db/schema";
import {
  sanitizeUrl,
  scrubPayload,
  sanitizeStack,
  truncate,
} from "./sanitize.js";
import {
  EVENT_TYPES,
  ERROR_TYPES,
  computeSeverity,
  SEVERITY_RANK,
  scoreSessionEvents,
} from "./analysis.js";
import { fingerprintFor, classifyEvent, issueTitleFor } from "./fingerprint.js";
import { HttpError, getOrCreateProject } from "./api-utils.js";

const MAX_PAYLOAD_BYTES = 8192;
export const MAX_BATCH = 50;
const WINDOW_MS = 10 * 86400 * 1000;
const ENVIRONMENTS = ["development", "staging", "production"];

export class ValidationError extends HttpError {
  constructor(message) {
    super(422, message);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEvent(raw, i) {
  const where = `events[${i}]`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError(`${where}: must be a JSON object`);
  }
  const type = String(raw.eventType ?? raw.event_type ?? raw.type ?? "");
  if (!EVENT_TYPES.includes(type)) {
    throw new ValidationError(
      `${where}: invalid event_type "${type}". Allowed: ${EVENT_TYPES.join(", ")}`
    );
  }
  let at;
  if (raw.timestamp == null) {
    at = new Date();
  } else {
    at = new Date(raw.timestamp);
    if (Number.isNaN(at.getTime())) {
      throw new ValidationError(`${where}: invalid timestamp "${raw.timestamp}"`);
    }
  }
  const now = Date.now();
  if (at.getTime() < now - WINDOW_MS || at.getTime() > now + 5 * 60 * 1000) {
    throw new ValidationError(
      `${where}: timestamp outside allowed window (last 10 days)`
    );
  }
  const payloadIn = raw.payload ?? {};
  if (payloadIn === null || typeof payloadIn !== "object" || Array.isArray(payloadIn)) {
    throw new ValidationError(`${where}: payload must be a JSON object`);
  }
  const payload = scrubPayload(payloadIn);
  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > MAX_PAYLOAD_BYTES) {
    throw new ValidationError(
      `${where}: payload too large (${payloadJson.length} > ${MAX_PAYLOAD_BYTES} bytes)`
    );
  }
  const pageUrlRaw = raw.pageUrl ?? raw.page_url ?? "";
  if (typeof pageUrlRaw !== "string" || pageUrlRaw.length > 500) {
    throw new ValidationError(
      `${where}: page_url must be a string of at most 500 characters`
    );
  }
  const name = raw.name ?? raw.event_name ?? null;
  if (name != null && (typeof name !== "string" || name.length > 200)) {
    throw new ValidationError(
      `${where}: event_name must be a string of at most 200 characters`
    );
  }
  const selector = raw.selector ?? raw.target_selector ?? null;
  if (selector != null && (typeof selector !== "string" || selector.length > 200)) {
    throw new ValidationError(
      `${where}: target_selector must be a string of at most 200 characters`
    );
  }
  const idempotencyKey = raw.idempotencyKey ?? raw.idempotency_key ?? null;
  if (
    idempotencyKey != null &&
    (typeof idempotencyKey !== "string" || idempotencyKey.length > 64)
  ) {
    throw new ValidationError(
      `${where}: idempotency_key must be a string of at most 64 characters`
    );
  }
  return {
    type,
    at: at.toISOString(),
    pageUrl: sanitizeUrl(pageUrlRaw),
    name: name ? truncate(name, 200) : null,
    selector: selector ? truncate(selector, 200) : null,
    payload,
    idempotencyKey,
  };
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export async function createSession(input = {}) {
  const project = await getOrCreateProject(input.projectId || DEMO_PROJECT_SLUG);
  const device = input.deviceType;
  const [row] = await db
    .insert(sessions)
    .values({
      projectId: project.id,
      pageUrl: sanitizeUrl(input.pageUrl || "/"),
      browserName:
        typeof input.browserName === "string" ? truncate(input.browserName, 60) : null,
      browserVersion:
        typeof input.browserVersion === "string"
          ? truncate(input.browserVersion, 40)
          : null,
      osName: typeof input.osName === "string" ? truncate(input.osName, 60) : null,
      deviceType: ["desktop", "mobile", "tablet"].includes(device) ? device : null,
      environment: ENVIRONMENTS.includes(input.environment)
        ? input.environment
        : "development",
    })
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Issue upsert (called inside a transaction)
// ---------------------------------------------------------------------------

export async function upsertIssueInTx(tx, projectId, cls, ref) {
  const fp = fingerprintFor(cls.kind, cls.message, cls.stack);
  const title = issueTitleFor(cls);
  const message = truncate(cls.message, 300);
  const at = new Date(ref.at);
  const [existing] = await tx
    .select()
    .from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.fingerprint, fp)))
    .limit(1);

  if (!existing) {
    const severity = computeSeverity(cls.kind, {
      status: cls.status,
      reason: cls.reason,
      occurrenceCount: 1,
      affectedSessions: 1,
    });
    const [created] = await tx
      .insert(issues)
      .values({
        projectId,
        fingerprint: fp,
        title,
        errorType: cls.kind,
        message,
        firstSeenAt: at,
        lastSeenAt: at,
        occurrenceCount: 1,
        affectedSessionCount: 1,
        severity,
        latestStackTrace: cls.stack ? sanitizeStack(cls.stack) : null,
      })
      .onConflictDoNothing({ target: [issues.projectId, issues.fingerprint] })
      .returning();
    if (created) {
      await tx
        .insert(issueOccurrences)
        .values({
          issueId: created.id,
          sessionId: ref.sessionId,
          eventId: ref.eventId,
          occurredAt: at,
        });
      return created;
    }
    // Lost a race — fall through to the update path below.
    const [raced] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.fingerprint, fp)))
      .limit(1);
    if (!raced) return null;
    return applyOccurrenceUpdate(raced, cls, ref, at);
  }
  return applyOccurrenceUpdate(existing, cls, ref, at);

  async function applyOccurrenceUpdate(issue, cls2, ref2, at2) {
    await tx.insert(issueOccurrences).values({
      issueId: issue.id,
      sessionId: ref2.sessionId,
      eventId: ref2.eventId,
      occurredAt: at2,
    });
    const [{ c }] = await tx
      .select({ c: sql`count(*)::int` })
      .from(issueOccurrences)
      .where(eq(issueOccurrences.issueId, issue.id));
    const [{ s }] = await tx
      .select({ s: sql`count(distinct ${issueOccurrences.sessionId})::int` })
      .from(issueOccurrences)
      .where(eq(issueOccurrences.issueId, issue.id));
    const severity = computeSeverity(cls2.kind, {
      status: cls2.status,
      reason: cls2.reason,
      occurrenceCount: c,
      affectedSessions: s,
    });
    const set = {
      lastSeenAt: at2,
      occurrenceCount: c,
      affectedSessionCount: s,
      updatedAt: new Date(),
    };
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[issue.severity]) {
      set.severity = severity;
    }
    if (cls2.stack) set.latestStackTrace = sanitizeStack(cls2.stack);
    const [updated] = await tx
      .update(issues)
      .set(set)
      .where(eq(issues.id, issue.id))
      .returning();
    return updated;
  }
}

// ---------------------------------------------------------------------------
// Event ingestion
// ---------------------------------------------------------------------------

export async function ingestEvents(sessionId, rawList) {
  if (!Array.isArray(rawList)) {
    throw new ValidationError(
      "Body must contain an 'events' array (or a single 'event' object)"
    );
  }
  if (rawList.length === 0) {
    throw new ValidationError("'events' array must not be empty");
  }
  if (rawList.length > MAX_BATCH) {
    throw new ValidationError(
      `Batch too large: ${rawList.length} events (max ${MAX_BATCH})`
    );
  }
  const validated = rawList.map(validateEvent);

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (!session) throw new HttpError(404, "Session not found");

    const [seqRow] = await tx
      .select({ m: sql`coalesce(max(${events.seq}), 0)` })
      .from(events)
      .where(eq(events.sessionId, sessionId));
    let seq = seqRow?.m ?? 0;

    const keys = validated.map((v) => v.idempotencyKey).filter(Boolean);
    const existingKeys = new Set();
    if (keys.length) {
      const rows = await tx
        .select({ k: events.idempotencyKey })
        .from(events)
        .where(inArray(events.idempotencyKey, keys));
      rows.forEach((r) => existingKeys.add(r.k));
    }

    let accepted = 0;
    let skipped = 0;
    let errCount = 0;
    const issueRows = [];

    for (const ev of validated) {
      if (ev.idempotencyKey && existingKeys.has(ev.idempotencyKey)) {
        skipped += 1;
        continue;
      }
      seq += 1;
      const [row] = await tx
        .insert(events)
        .values({
          sessionId,
          at: new Date(ev.at),
          type: ev.type,
          pageUrl: ev.pageUrl,
          name: ev.name,
          selector: ev.selector,
          payload: ev.payload,
          seq,
          idempotencyKey: ev.idempotencyKey,
        })
        .returning({ id: events.id });
      accepted += 1;
      if (ERROR_TYPES.has(ev.type)) {
        errCount += 1;
        const cls = classifyEvent({
          type: ev.type,
          name: ev.name,
          payload: ev.payload,
        });
        if (cls) {
          const issue = await upsertIssueInTx(tx, session.projectId, cls, {
            sessionId,
            eventId: row.id,
            at: new Date(ev.at),
          });
          if (issue) issueRows.push(issue);
        }
      }
    }

    await tx
      .update(sessions)
      .set({
        eventCount: sql`${sessions.eventCount} + ${accepted}`,
        errorCount: sql`${sessions.errorCount} + ${errCount}`,
      })
      .where(eq(sessions.id, sessionId));

    const end = validated.find((v) => v.type === "session_end");
    if (end && !session.endedAt) {
      const all = await tx
        .select({ type: events.type, name: events.name })
        .from(events)
        .where(eq(events.sessionId, sessionId))
        .orderBy(asc(events.seq));
      const anomaly = scoreSessionEvents(all);
      await tx
        .update(sessions)
        .set({
          endedAt: new Date(end.at),
          anomalyScore: anomaly.score,
        })
        .where(eq(sessions.id, sessionId));
    }

    const seen = new Map();
    issueRows.forEach((i) => seen.set(i.id, i));
    return {
      accepted,
      skipped,
      errorCount: errCount,
      issues: [...seen.values()].map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        occurrenceCount: i.occurrenceCount,
        affectedSessionCount: i.affectedSessionCount,
      })),
    };
  });
}
