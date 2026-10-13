import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { handleError, clamp, jsonError } from "@/lib/api-utils.js";

export const dynamic = "force-dynamic";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "acknowledged", "resolved"];

export async function GET(req) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = clamp(sp.get("page"), 1, 10000);
    const pageSize = clamp(sp.get("pageSize") || 20, 1, 100);

    const conds = [];
    const severity = sp.get("severity");
    if (severity) {
      if (!SEVERITIES.includes(severity)) {
        return jsonError(422, `severity must be one of: ${SEVERITIES.join(", ")}`);
      }
      conds.push(eq(issues.severity, severity));
    }
    const status = sp.get("status");
    if (status) {
      if (!STATUSES.includes(status)) {
        return jsonError(422, `status must be one of: ${STATUSES.join(", ")}`);
      }
      conds.push(eq(issues.status, status));
    }
    const q = (sp.get("q") || "").trim();
    if (q) {
      const like = `%${q}%`;
      conds.push(or(ilike(issues.title, like), ilike(issues.message, like)));
    }

    const sort = sp.get("sort") || "last_seen";
    const orderBy =
      sort === "occurrences"
        ? desc(issues.occurrenceCount)
        : sort === "created"
          ? desc(issues.createdAt)
          : desc(issues.lastSeenAt);

    const where = conds.length ? and(...conds) : undefined;
    const [{ n }] = await db
      .select({ n: sql`count(*)::int` })
      .from(issues)
      .where(where);
    const items = await db
      .select()
      .from(issues)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return Response.json({
      items,
      total: n,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(n / pageSize)),
    });
  } catch (err) {
    return handleError(err);
  }
}
