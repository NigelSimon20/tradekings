import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { originFromRequest } from "@/lib/api/origin";
import {
  OAUTH_STATE_COOKIE,
  exchangeCodeForIdentity,
  readState,
} from "@/lib/auth/google-oauth";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";
import { resolveSignIn } from "@/lib/services/auth";

/** Completes the Google sign-in and, if the person is allowed in, signs them in. */
export async function GET(request: Request): Promise<Response> {
  const origin = originFromRequest(request);
  const config = getConfig();
  const params = new URL(request.url).searchParams;
  const store = await cookies();

  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin));

  if (!config.auth.google) return fail("Google sign-in is not set up.");
  if (params.get("error")) return fail("Sign-in was cancelled.");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("That sign-in link was incomplete. Try again.");

  const parsed = await readState(state, config.auth.secret);
  const nonce = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!parsed || !nonce || parsed.nonce !== nonce) {
    return fail("That sign-in could not be verified. Please start again.");
  }

  try {
    const identity = await exchangeCodeForIdentity({
      code,
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret,
      redirectUri: `${origin}/api/auth/google/callback`,
    });

    if (!identity.emailVerified) return fail("That Google account has no verified email address.");

    const { user, reason } = await resolveSignIn(identity.email, identity.name, "google");
    if (!user) return fail(reason ?? "That account may not use the tracker.");

    store.set(SESSION_COOKIE, await createSessionToken(config.auth.secret, user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return NextResponse.redirect(new URL(parsed.next, origin));
  } catch (error) {
    return fail((error as Error).message);
  }
}
