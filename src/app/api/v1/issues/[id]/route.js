import { eq } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import {
  handleError,
  jsonError,
  readJson,
} from "@/lib/api-utils.js";
import { fetchIssueDetail } from "@/lib/issue-detail.js";

export const dynamic = "force-dynamic";

const TRANSITIONS = {
  open: ["acknowledged", "resolved"],
  acknowledged: ["open", "resolved"],
  resolved: ["open"],
};

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  try {
    const detail = await fetchIssueDetail(id);
    if (!detail) return jsonError(404, "Issue not found");
    return Response.json(detail);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req, ctx) {
  const { id } = await ctx.params;
  try {
    const body = await readJson(req, 8192);
    const target = body.status;
    if (!["open", "acknowledged", "resolved"].includes(target)) {
      return jsonError(
        422,
        "status must be one of: open, acknowledged, resolved"
      );
    }
    const [current] = await db
      .select({ id: issues.id, status: issues.status })
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);
    if (!current) return jsonError(404, "Issue not found");
    if (!TRANSITIONS[current.status].includes(target)) {
      return jsonError(
        409,
        `Cannot transition from "${current.status}" to "${target}". Allowed: ${TRANSITIONS[current.status].join(", ")}`
      );
    }
    const [updated] = await db
      .update(issues)
      .set({ status: target, updatedAt: new Date() })
      .where(eq(issues.id, id))
      .returning();
    return Response.json({ issue: updated });
  } catch (err) {
    return handleError(err);
  }
}
