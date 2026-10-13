import { and, desc, eq, gte, ilike, lte, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import {
  handleError,
  readJson,
  clamp,
  jsonError,
} from "@/lib/api-utils.js";
import { createSession } from "@/lib/pipeline.js";

export const dynamic = "force-dynamic";

const ENVIRONMENTS = ["development", "staging", "production"];

export async function GET(req) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = clamp(sp.get("page"), 1, 10000);
    const pageSize = clamp(sp.get("pageSize") || 20, 1, 100);

    const conds = [];
    const environment = sp.get("environment");
    if (environment) {
      if (!ENVIRONMENTS.includes(environment)) {
        return jsonError(
          422,
          `environment must be one of: ${ENVIRONMENTS.join(", ")}`
        );
      }
      conds.push(eq(sessions.environment, environment));
    }
    if (sp.get("errors") === "true") {
      conds.push(gt(sessions.errorCount, 0));
    }
    const q = (sp.get("q") || "").trim();
    if (q) conds.push(ilike(sessions.pageUrl, `%${q}%`));
    if (sp.get("from")) {
      const d = new Date(sp.get("from"));
      if (Number.isNaN(d.getTime())) return jsonError(422, "invalid 'from' date");
      conds.push(gte(sessions.startedAt, d));
    }
    if (sp.get("to")) {
      const d = new Date(sp.get("to"));
      if (Number.isNaN(d.getTime())) return jsonError(422, "invalid 'to' date");
      conds.push(lte(sessions.startedAt, d));
    }

    const where = conds.length ? and(...conds) : undefined;
    const [{ n }] = await db
      .select({ n: sql`count(*)::int` })
      .from(sessions)
      .where(where);
    const items = await db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.startedAt))
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

export async function POST(req) {
  try {
    const body = await readJson(req, 64 * 1024);
    const session = await createSession(body);
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
