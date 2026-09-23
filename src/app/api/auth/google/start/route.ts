import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { OAUTH_STATE_COOKIE, authorizeUrl, createState } from "@/lib/auth/google-oauth";
import { originFromRequest } from "@/lib/api/origin";
import { getConfig } from "@/lib/config/env";

/** Starts the Google sign-in. */
export async function GET(request: Request): Promise<Response> {
  const config = getConfig();
  if (!config.auth.google) {
    return NextResponse.redirect(new URL("/login?error=google-not-configured", originFromRequest(request)));
  }

  const requested = new URL(request.url).searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") ? requested : "/";
  const nonce = crypto.randomUUID();
  const origin = originFromRequest(request);

  // The nonce is held in a cookie as well as in the signed state, so a sign-in
  // cannot be started in one browser and finished in another.
  (await cookies()).set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(
    authorizeUrl({
      clientId: config.auth.google.clientId,
      redirectUri: `${origin}/api/auth/google/callback`,
      state: await createState(nonce, next, config.auth.secret),
    }),
  );
}
