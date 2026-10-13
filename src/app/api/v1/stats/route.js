import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, events, issues } from "@/db/schema";
import { handleError } from "@/lib/api-utils.js";

export const dynamic = "force-dynamic";

function rowsOf(res) {
  return Array.isArray(res) ? res : res.rows ?? [];
}

export async function GET() {
  try {
    const since = new Date(Date.now() - 13 * 86400000);
    const [a] = await db.select({ n: sql`count(*)::int` }).from(sessions);
    const [b] = await db.select({ n: sql`count(*)::int` }).from(events);
    const [c] = await db
      .select({ n: sql`count(*)::int` })
      .from(issues)
      .where(eq(issues.status, "open"));
    const [d] = await db
      .select({ n: sql`count(*)::int` })
      .from(issues)
      .where(
        and(
          inArray(issues.severity, ["high", "critical"]),
          inArray(issues.status, ["open", "acknowledged"])
        )
      );
    const [e] = await db
      .select({ n: sql`count(*)::int` })
      .from(sessions)
      .where(gt(sessions.errorCount, 0));

    const trendRaw = rowsOf(
      await db.execute(
        sql`select to_char("timestamp", 'YYYY-MM-DD') as day,
                  count(*)::int as n
             from events
            where "timestamp" >= ${since.toISOString()}
              and "event_type" in ('console_error','unhandled_error','network_error','http_error')
            group by 1 order by 1`
      )
    );
    const byDay = new Map(trendRaw.map((r) => [r.day, Number(r.n)]));
    const trend = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      trend.push({ day, errors: byDay.get(day) || 0 });
    }

    const typeRows = rowsOf(
      await db.execute(
        sql`select "event_type" as type, count(*)::int as n from events group by 1`
      )
    );

    return Response.json({
      totalSessions: a.n,
      totalEvents: b.n,
      openIssues: c.n,
      highSeverityIssues: d.n,
      affectedSessions: e.n,
      trend,
      byType: Object.fromEntries(typeRows.map((r) => [r.type, Number(r.n)])),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
