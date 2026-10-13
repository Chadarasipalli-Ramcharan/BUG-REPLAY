// Simulated "successful" business endpoint for the demo site.

export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    { ok: true, order: "BR-1042", message: "Order placed (simulated)" },
    { status: 201 }
  );
}

export async function GET() {
  return Response.json({ ok: true, message: "Demo endpoint healthy" });
}
