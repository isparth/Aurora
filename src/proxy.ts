import { NextResponse, type NextRequest } from "next/server";

import { createFixedWindowLimiter } from "@/lib/rate-limit";

/**
 * Best-effort per-IP rate limiting for a public, account-less deployment. It protects the free
 * upstream services (OSRM, Photon, Open-Meteo) and the hosting free tier from floods. State is
 * per server instance, so treat it as a first line of defence, not a guarantee.
 */
const RULES: { name: string; matches: (path: string) => boolean; limit: number }[] = [
  { name: "search", matches: (p) => p.startsWith("/api/geocode"), limit: 90 },
  { name: "images", matches: (p) => p.startsWith("/api/cameras/") && p.endsWith("/image"), limit: 120 },
  { name: "api", matches: (p) => p.startsWith("/api/"), limit: 60 },
  { name: "pages", matches: (p) => p.startsWith("/results") || p.startsWith("/location/"), limit: 40 },
];

const take = createFixedWindowLimiter({ windowMs: 60_000 });

function clientIp(request: NextRequest): string {
  // On Vercel these headers are set by the platform and can't be spoofed by the client.
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function proxy(request: NextRequest) {
  // Link prefetches only fetch loading shells; don't let them eat the page budget.
  if (request.headers.get("next-router-prefetch")) return NextResponse.next();

  const path = request.nextUrl.pathname;
  const rule = RULES.find((r) => r.matches(path));
  if (!rule) return NextResponse.next();

  const { ok, retryAfter } = take(`${rule.name}:${clientIp(request)}`, rule.limit);
  if (ok) return NextResponse.next();

  const headers = { "Retry-After": String(retryAfter), "Cache-Control": "no-store" };
  if (path.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests — please wait a minute and try again." } },
      { status: 429, headers },
    );
  }
  return new NextResponse("Too many requests — please wait a minute and try again.", {
    status: 429,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/api/:path*", "/results", "/location/:path*"],
};
