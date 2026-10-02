import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/** The map style and all its tiles, glyphs and sprites are served from this origin. */
const mapOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark").origin;
  } catch {
    return "https://tiles.openfreemap.org";
  }
})();

// CSP without nonces, per https://nextjs.org/docs/app/guides/content-security-policy#without-nonces
// If you switch to a map provider that serves tiles from other hosts, add them to img-src/connect-src.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${mapOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${mapOrigin}${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
