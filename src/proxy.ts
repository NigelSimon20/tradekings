import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

/**
 * Keeps the contract database behind a sign-in.
 *
 * Signing in is required as soon as either Google sign-in or a shared password
 * is configured. Scheduled jobs authenticate with CRON_SECRET instead and are
 * allowed through here.
 */
export async function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim() ?? "";
  const googleConfigured = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),
  );
  if (!password && !googleConfigured) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  // Must match how the rest of the app derives the key, or every valid cookie
  // would be rejected here and people would be bounced back to sign-in.
  const secret = process.env.AUTH_SECRET?.trim() || password;
  if (!secret) {
    // No stable key: the app is signing with a throwaway one, so only the
    // pages themselves can verify a session.
    return NextResponse.next();
  }
  const user = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (user) return NextResponse.next();

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
