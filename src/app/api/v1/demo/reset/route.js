import { handleError, jsonError } from "@/lib/api-utils.js";
import { resetDemoData } from "@/lib/seed.js";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Destructive action is gated: disabled unless the deployment is
    // explicitly marked as non-production (BUGREPLAY_ENV != "production").
    if (process.env.BUGREPLAY_ENV === "production") {
      return jsonError(
        403,
        "Demo reset is disabled in production deployments."
      );
    }
    const result = await resetDemoData();
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
