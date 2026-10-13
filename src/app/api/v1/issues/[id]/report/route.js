import { handleError, jsonError } from "@/lib/api-utils.js";
import { fetchIssueDetail } from "@/lib/issue-detail.js";
import { buildIssueReport } from "@/lib/report.js";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  try {
    const detail = await fetchIssueDetail(id);
    if (!detail) return jsonError(404, "Issue not found");
    const report = buildIssueReport(detail.issue, detail);
    return Response.json(report);
  } catch (err) {
    return handleError(err);
  }
}
