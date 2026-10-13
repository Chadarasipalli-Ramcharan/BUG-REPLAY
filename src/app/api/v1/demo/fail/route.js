// Controlled failing endpoint used by the demo site. Returns a configurable
// 4xx/5xx status so the SDK captures a real HTTP error.

export const dynamic = "force-dynamic";

export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const status = Math.min(599, Math.max(400, parseInt(sp.get("status") || "500", 10) || 500));
  return Response.json(
    {
      ok: false,
      code: `SIM-${status}`,
      error: sp.get("message") || `Simulated server failure (HTTP ${status})`,
    },
    { status }
  );
}

export async function POST(req) {
  return GET(req);
}
