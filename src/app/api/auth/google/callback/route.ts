import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { originFromRequest } from "@/lib/api/origin";
import {
  DRIVE_FILE_SCOPE,
  OAUTH_STATE_COOKIE,
  exchangeCode,
  exchangeCodeForIdentity,
  readState,
} from "@/lib/auth/google-oauth";
import { canBillboards } from "@/lib/auth/roles";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken } from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";
import { PROJECTS, PROJECT_IDS, canOpenProject, projectForPath } from "@/lib/domain/projects";
import { getCurrentUser, resolveSignIn } from "@/lib/services/auth";
import { connectDriveAccount } from "@/lib/services/billboards";

/** Completes the Google sign-in and, if the person is allowed in, signs them in. */
export async function GET(request: Request): Promise<Response> {
  const origin = originFromRequest(request);
  const config = getConfig();
  const params = new URL(request.url).searchParams;
  const store = await cookies();

  const fail = (message: string, app?: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}${app ? `&app=${app}` : ""}`, origin),
    );

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

  if (parsed.purpose === "drive") {
    return completeDriveConnection(code, origin, parsed.next);
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

    // Signed in for the tracker chosen on the sign-in page, or not at all.
    const project = projectForPath(parsed.next);
    if (!canOpenProject(user, project)) {
      const other = PROJECT_IDS.find((id) => id !== project && canOpenProject(user, id));
      return fail(
        `${identity.email} does not have access to the ${PROJECTS[project].name}.${
          other ? ` It can open the ${PROJECTS[other].name} — choose that instead.` : ""
        } Ask an administrator if you need access.`,
        project,
      );
    }

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

/**
 * The Drive half of this callback: an administrator came back from connecting
 * a Google account for uploads. They stay signed in as themselves; only the
 * account's Drive permission is kept.
 */
async function completeDriveConnection(code: string, origin: string, next: string): Promise<Response> {
  const config = getConfig();
  const back = (query: string) => NextResponse.redirect(new URL(`${next}?${query}`, origin));
  const fail = (message: string) => back(`drive-error=${encodeURIComponent(message)}`);

  const user = await getCurrentUser();
  if (!user || !canBillboards(user, "manageBillboards") || !config.auth.google) {
    return fail("Only a billboard administrator can connect Google Drive.");
  }

  try {
    const { identity, refreshToken, scope } = await exchangeCode({
      code,
      clientId: config.auth.google.clientId,
      clientSecret: config.auth.google.clientSecret,
      redirectUri: `${origin}/api/auth/google/callback`,
    });
    if (!scope.split(" ").includes(DRIVE_FILE_SCOPE)) {
      return fail("Google Drive access was not ticked on Google's screen. Connect again and allow it.");
    }
    if (!refreshToken) {
      return fail("Google did not give the tracker lasting access. Connect again and approve every step.");
    }

    await connectDriveAccount(
      { email: identity.email, refreshToken },
      config.auth.google.clientId,
      config.auth.google.clientSecret,
      user.email || user.name,
    );
    return back("drive=connected");
  } catch (error) {
    return fail((error as Error).message);
  }
}
