import "server-only";

import { signValue, verifyValue } from "@/lib/auth/session";

/**
 * A minimal OpenID Connect sign-in with Google.
 *
 * Google is already the home of the contract database, so it also proves who
 * people are: the tracker stores no passwords and inherits Google's password
 * rules and two-factor settings.
 */
export const OAUTH_STATE_COOKIE = "tkzim_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

export function authorizeUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("access_type", "online");
  // Always let the person choose which Google account to use.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/**
 * What a trip to Google is for. Both use the one registered callback, so the
 * purpose travels in the signed state and cannot be swapped on the way back.
 */
export type OAuthPurpose = "signin" | "drive";

/** `nonce|expiry|purpose|next`, signed, so the callback can trust what it is given. */
export async function createState(
  nonce: string,
  next: string,
  secret: string,
  purpose: OAuthPurpose = "signin",
): Promise<string> {
  const payload = `${nonce}|${Date.now() + STATE_TTL_MS}|${purpose}|${next}`;
  return `${encodeURIComponent(payload)}.${await signValue(payload, secret)}`;
}

export async function readState(
  state: string,
  secret: string,
): Promise<{ nonce: string; next: string; purpose: OAuthPurpose } | null> {
  // The signature is base64url (no dots), so split on the last dot: the
  // return path before it may contain dots of its own.
  const cut = state.lastIndexOf(".");
  const encoded = state.slice(0, cut);
  const signature = state.slice(cut + 1);
  if (cut === -1 || !encoded || !signature) return null;

  const payload = decodeURIComponent(encoded);
  if (!(await verifyValue(payload, signature, secret))) return null;

  const [nonce, expiry, purpose, ...rest] = payload.split("|");
  if (!nonce || Number(expiry) < Date.now()) return null;
  if (purpose !== "signin" && purpose !== "drive") return null;

  const next = rest.join("|");
  return { nonce, purpose, next: next.startsWith("/") ? next : "/" };
}

/** Only the files and folders the tracker itself creates — nothing else in the account. */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/**
 * Asks a Google account to let the tracker store billboard photos in its
 * Drive. `offline` + `consent` makes Google return a refresh token, so uploads
 * keep working after the person has left.
 */
export function driveConnectUrl(options: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `openid email ${DRIVE_FILE_SCOPE}`);
  url.searchParams.set("state", options.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  return url.toString();
}

export interface GoogleIdentity {
  email: string;
  name: string;
  emailVerified: boolean;
}

/**
 * Swaps the one-time code for the person's identity.
 *
 * The token comes straight from Google's endpoint over TLS using our client
 * secret, so the claims are read directly — but the audience, issuer and expiry
 * are still checked, because a token meant for another application must never
 * be accepted here.
 */
export async function exchangeCodeForIdentity(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleIdentity> {
  return (await exchangeCode(options)).identity;
}

/** Swaps the code for the identity, plus the refresh token and scopes when access was granted. */
export async function exchangeCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ identity: GoogleIdentity; refreshToken: string | null; scope: string }> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Google would not complete the sign-in. Check the tracker's Google settings.");
  }

  const body = (await response.json()) as { id_token?: string; refresh_token?: string; scope?: string };
  if (!body.id_token) throw new Error("Google did not return an identity for that account.");

  const claims = decodeJwtClaims(body.id_token);

  if (claims.aud !== options.clientId) throw new Error("That sign-in was meant for another application.");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(String(claims.iss))) {
    throw new Error("That sign-in did not come from Google.");
  }
  if (Number(claims.exp) * 1000 < Date.now()) throw new Error("That sign-in has expired. Try again.");

  return {
    identity: {
      email: String(claims.email ?? ""),
      name: String(claims.name ?? ""),
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
    },
    refreshToken: body.refresh_token ?? null,
    scope: body.scope ?? "",
  };
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("Google returned an identity that could not be read.");

  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  // Names can contain accents, so decode the payload as UTF-8.
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}
