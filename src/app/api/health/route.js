import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      service: "bugreplay",
      database: "up",
      time: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      { ok: false, service: "bugreplay", database: "down" },
      { status: 503 }
    );
  }
}
