import path from "node:path";
import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The tracker holds employee personal information, so the browser is told to
 * lock down what the page may do: no framing (clickjacking), no MIME sniffing,
 * no referrer leakage of contract URLs to other sites, and no loading of
 * scripts, styles or images from anywhere but this app.
 *
 * The content policy is applied in production only — the development server
 * needs `eval` and a websocket for hot reloading.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Next.js inlines its bootstrap script and Tailwind inlines styles.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }]
    : []),
];

const nextConfig: NextConfig = {
  // Pin the workspace root so a lockfile elsewhere on the machine cannot be
  // picked up during tracing.
  turbopack: { root: path.resolve(".") },

  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // Employee data must never be cached by a proxy or a shared browser.
        source: "/api/export",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" }],
      },
    ];
  },
};

export default nextConfig;
