import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Keeps the contract database behind the shared password when APP_PASSWORD is
 * set. Scheduled jobs authenticate with CRON_SECRET instead and are allowed
 * through here.
 */
export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim() ?? "";
  if (!password) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/cron") || pathname === "/login") return NextResponse.next();

  const secret = process.env.AUTH_SECRET?.trim() || password;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, secret)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
