import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { originFromRequest } from "@/lib/api/origin";
import { OAUTH_STATE_COOKIE, createState, driveConnectUrl } from "@/lib/auth/google-oauth";
import { getConfig } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/services/auth";
import { DRIVE_APPS, driveAppFor } from "@/lib/services/drive-apps";

/**
 * Sends an administrator to Google to connect the account whose Drive will
 * hold an app's uploaded files (`?app=billboards` or `?app=licenses`). Uses the
 * sign-in's registered callback; the signed state marks the trip as a Drive
 * connection and says which app's page to return to.
 */
export async function GET(request: Request): Promise<Response> {
  const origin = originFromRequest(request);
  const app = driveAppFor(new URL(request.url).searchParams.get("app"));
  if (!app) return NextResponse.redirect(new URL("/", origin));

  const { settingsPath, allowed, who } = DRIVE_APPS[app];
  const back = (message: string) =>
    NextResponse.redirect(new URL(`${settingsPath}?drive-error=${encodeURIComponent(message)}`, origin));

  const user = await getCurrentUser();
  if (!user || !allowed(user)) return back(`Only ${who} can connect Google Drive.`);
  const config = getConfig();
  if (!config.auth.google) return back("Google sign-in is not set up, so there is no Google app to connect Drive with.");

  const nonce = crypto.randomUUID();
  (await cookies()).set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(
    driveConnectUrl({
      clientId: config.auth.google.clientId,
      redirectUri: `${origin}/api/auth/google/callback`,
      state: await createState(nonce, settingsPath, config.auth.secret, "drive"),
    }),
  );
}
