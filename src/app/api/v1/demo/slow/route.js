// Slow endpoint used by the demo site to produce a real network timeout
// when the client aborts before it responds.

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  await new Promise((r) => setTimeout(r, 4000));
  return Response.json({
    ok: true,
    message: "Slow request finally completed",
    tookMs: Date.now() - start,
  });
}
