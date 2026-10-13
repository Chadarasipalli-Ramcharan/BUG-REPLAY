import { handleError, jsonError } from "@/lib/api-utils.js";
import { fetchIssueDetail } from "@/lib/issue-detail.js";
import { buildIssueReport, reportToMarkdown } from "@/lib/report.js";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const { id } = await ctx.params;
  try {
    const detail = await fetchIssueDetail(id);
    if (!detail) return jsonError(404, "Issue not found");
    const report = buildIssueReport(detail.issue, detail);
    const markdown = reportToMarkdown(report);
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="bugreplay-${detail.issue.id.slice(
          0,
          8
        )}.md"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
