import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, events, issues, issueOccurrences } from "@/db/schema";
import { handleError, jsonError } from "@/lib/api-utils.js";
import { scoreSessionEvents } from "@/lib/analysis.js";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  try {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!session) return jsonError(404, "Session not found");

    const evs = await db
      .select({ type: events.type, name: events.name })
      .from(events)
      .where(eq(events.sessionId, id))
      .orderBy(asc(events.seq));
    const anomaly = scoreSessionEvents(evs);

    const linked = await db
      .select({
        id: issues.id,
        title: issues.title,
        severity: issues.severity,
        status: issues.status,
        occurrenceCount: issues.occurrenceCount,
      })
      .from(issues)
      .innerJoin(
        issueOccurrences,
        and(
          eq(issueOccurrences.issueId, issues.id),
          eq(issueOccurrences.sessionId, id)
        )
      );
    const unique = new Map(linked.map((r) => [r.id, r]));

    return Response.json({ ...session, anomaly, issues: [...unique.values()] });
  } catch (err) {
    return handleError(err);
  }
}
