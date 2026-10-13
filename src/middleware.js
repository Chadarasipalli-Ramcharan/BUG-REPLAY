import { NextResponse } from "next/server";

// CORS for the ingestion API. Origins must be listed in BUGREPLAY_CORS_ORIGINS
// (comma-separated). No wildcard CORS — unmatched origins get no headers.
export function middleware(req) {
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.BUGREPLAY_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isAllowed = origin && allowed.includes(origin);

  if (req.method === "OPTIONS") {
    if (isAllowed) {
      const res = new NextResponse(null, { status: 204 });
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      res.headers.set("Access-Control-Allow-Headers", "Content-Type");
      res.headers.set("Access-Control-Max-Age", "86400");
      return res;
    }
    return new NextResponse(null, { status: 204 });
  }

  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
