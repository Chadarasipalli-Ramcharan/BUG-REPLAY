// Shared detail assembly for the issue API: occurrences, evidence,
// derived reproduction steps, and rule-based diagnostic hints.

import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { issues, issueOccurrences, sessions, events } from "@/db/schema";
import { diagnosticHints } from "./analysis.js";

function detailForEvent(e) {
  const p = e.payload || {};
  switch (e.type) {
    case "http_error":
      return `HTTP ${p.status ?? "?"} ${p.method || "GET"} ${p.url || ""}${
        p.durationMs != null ? ` in ${p.durationMs} ms` : ""
      }`;
    case "network_error":
      return `${p.reason || "failure"} ${p.method || "GET"} ${p.url || ""}${
        p.durationMs != null ? ` after ${p.durationMs} ms` : ""
      }`;
    case "unhandled_error":
    case "console_error":
      return p.stack ? `Stack: ${String(p.stack).split("\n")[0]}` : null;
    default:
      return null;
  }
}

function stepForEvent(e) {
  switch (e.type) {
    case "session_start":
      return `Opened ${e.pageUrl}`;
    case "click":
      return `Clicked ${e.name || e.selector || "an element"}`;
    case "navigation":
      return `Navigated (${e.name || e.pageUrl})`;
    case "custom_event":
      return `Custom event: ${e.name}`;
    case "http_error":
    case "network_error":
    case "console_error":
    case "unhandled_error":
      return e.name || e.type;
    default:
      return e.type;
  }
}

export async function fetchIssueDetail(issueId) {
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!issue) return null;

  const occs = await db
    .select()
    .from(issueOccurrences)
    .where(eq(issueOccurrences.issueId, issueId))
    .orderBy(desc(issueOccurrences.occurredAt))
    .limit(30);

  const sessionIds = [...new Set(occs.map((o) => o.sessionId))];
  const eventIds = [...new Set(occs.map((o) => o.eventId).filter(Boolean))];

  const sessionRows = sessionIds.length
    ? await db
        .select()
        .from(sessions)
        .where(inArray(sessions.id, sessionIds))
    : [];
  const sessionMap = new Map(sessionRows.map((s) => [s.id, s]));

  const eventRows = eventIds.length
    ? await db.select().from(events).where(inArray(events.id, eventIds))
    : [];
  const eventMap = new Map(eventRows.map((e) => [e.id, e]));

  const occurrences = occs.map((o) => ({
    id: o.id,
    occurredAt: o.occurredAt,
    sessionId: o.sessionId,
    eventId: o.eventId,
    session: sessionMap.get(o.sessionId) || null,
    event: o.eventId ? eventMap.get(o.eventId) || null : null,
  }));

  // Evidence: triggering events plus network failures in affected sessions.
  const evidenceIds = new Set(eventIds);
  if (sessionIds.length) {
    const netRows = await db
      .select()
      .from(events)
      .where(
        and(
          inArray(events.sessionId, sessionIds),
          inArray(events.type, ["http_error", "network_error"])
        )
      )
      .orderBy(desc(events.at))
      .limit(30);
    netRows.forEach((e) => evidenceIds.add(e.id));
  }
  let allEvidence = [];
  if (evidenceIds.size) {
    allEvidence = await db
      .select()
      .from(events)
      .where(inArray(events.id, [...evidenceIds]));
  }
  const evidence = allEvidence
    .map((e) => ({
      id: e.id,
      at: e.at,
      type: e.type,
      name: e.name,
      selector: e.selector,
      sessionId: e.sessionId,
      pageUrl: e.pageUrl,
      payload: e.payload,
      detail: detailForEvent(e),
    }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 15);

  // Reproduction steps: up to 8 events before the latest triggering event.
  let reproduction = [];
  const latest = occurrences[0];
  if (latest?.event) {
    const prior = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.sessionId, latest.sessionId),
          lt(events.seq, latest.event.seq)
        )
      )
      .orderBy(desc(events.seq))
      .limit(8);
    reproduction = prior
      .reverse()
      .map(stepForEvent)
      .concat([`Encountered: ${issue.title} — ${issue.message}`]);
  }

  const hints = diagnosticHints(issue);

  return { issue, occurrences, evidence, reproduction, hints };
}
