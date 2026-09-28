import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { originFromRequest } from "@/lib/api/origin";
import { canBillboards } from "@/lib/auth/roles";
import { OAUTH_STATE_COOKIE, createState, driveConnectUrl } from "@/lib/auth/google-oauth";
import { getConfig } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/services/auth";

const SETTINGS_PATH = "/billboards/settings";

/**
 * Sends a billboard administrator to Google to connect the account whose
 * Drive will hold uploaded photos. Uses the sign-in's registered callback; the
 * signed state marks the trip as a Drive connection.
 */
export async function GET(request: Request): Promise<Response> {
  const origin = originFromRequest(request);
  const back = (message: string) =>
    NextResponse.redirect(new URL(`${SETTINGS_PATH}?drive-error=${encodeURIComponent(message)}`, origin));

  const user = await getCurrentUser();
  if (!user || !canBillboards(user, "manageBillboards")) {
    return back("Only a billboard administrator can connect Google Drive.");
  }
  const config = getConfig();
  if (!config.auth.google) {
    return back("Google sign-in is not set up, so there is no Google app to connect Drive with.");
  }

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
      state: await createState(nonce, SETTINGS_PATH, config.auth.secret, "drive"),
    }),
  );
}
