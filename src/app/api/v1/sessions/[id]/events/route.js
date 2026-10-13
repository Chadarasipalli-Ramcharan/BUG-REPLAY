import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, events, issues, issueOccurrences } from "@/db/schema";
import {
  handleError,
  readJson,
  clamp,
  jsonError,
} from "@/lib/api-utils.js";
import { ingestEvents } from "@/lib/pipeline.js";
import { rateLimit } from "@/lib/ratelimit.js";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  try {
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!session) return jsonError(404, "Session not found");

    const sp = req.nextUrl.searchParams;
    const page = clamp(sp.get("page"), 1, 10000);
    const pageSize = clamp(sp.get("pageSize") || 200, 1, 500);

    const [{ n }] = await db
      .select({ n: sql`count(*)::int` })
      .from(events)
      .where(eq(events.sessionId, id));

    const items = await db
      .select()
      .from(events)
      .where(eq(events.sessionId, id))
      .orderBy(asc(events.seq))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const errorIds = items
      .filter(
        (e) =>
          ["console_error", "unhandled_error", "network_error", "http_error"].includes(
            e.type
          )
      )
      .map((e) => e.id);
    const occMap = new Map();
    if (errorIds.length) {
      const occs = await db
        .select({
          eventId: issueOccurrences.eventId,
          issueId: issues.id,
          title: issues.title,
          severity: issues.severity,
          status: issues.status,
        })
        .from(issueOccurrences)
        .innerJoin(issues, eq(issueOccurrences.issueId, issues.id))
        .where(inArray(issueOccurrences.eventId, errorIds));
      occs.forEach((o) =>
        occMap.set(o.eventId, {
          id: o.issueId,
          title: o.title,
          severity: o.severity,
          status: o.status,
        })
      );
    }
    const withIssues = items.map((e) => ({ ...e, issue: occMap.get(e.id) || null }));

    return Response.json({
      sessionId: id,
      total: n,
      page,
      pageSize,
      events: withIssues,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req, ctx) {
  const { id } = await ctx.params;
  try {
    const ip = req.headers.get("x-forwarded-for") || "local";
    if (!rateLimit(`ingest:${id}`, 120, 60000)) {
      return jsonError(429, "Too many ingestion requests for this session");
    }
    if (!rateLimit(`ingest-ip:${ip}`, 480, 60000)) {
      return jsonError(429, "Too many ingestion requests from this client");
    }

    const body = await readJson(req, 256 * 1024);
    let raw;
    if (Array.isArray(body)) {
      raw = body;
    } else if (Array.isArray(body.events)) {
      raw = body.events;
    } else if (body.event) {
      raw = [body.event];
    } else {
      return jsonError(400, "Send { \"events\": [...] } or { \"event\": {...} }");
    }

    const result = await ingestEvents(id, raw);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
