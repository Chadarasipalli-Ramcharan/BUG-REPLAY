import { handleError } from "@/lib/api-utils.js";
import { seedDemoData } from "@/lib/seed.js";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await seedDemoData();
    return Response.json(result, { status: result.alreadySeeded ? 200 : 201 });
  } catch (err) {
    return handleError(err);
  }
}
