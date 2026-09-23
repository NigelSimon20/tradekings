import { parseRole, type Role } from "@/lib/auth/roles";

/**
 * Sign-in sessions.
 *
 * The cookie carries who the person is and what they may do, signed with
 * AUTH_SECRET so it cannot be edited in the browser. Web Crypto is used so the
 * same code runs in the proxy and in server actions.
 */
export const SESSION_COOKIE = "tkzim_contract_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface SessionUser {
  email: string;
  name: string;
  role: Role;
  /** How the person signed in, for the run log. */
  via: "google" | "password";
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

/** Compares without leaking length or position through timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function createSessionToken(secret: string, user: SessionUser): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_SECONDS * 1000 }),
    ),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

/** Returns the signed-in person, or null when the cookie is missing or invalid. */
export async function readSessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!safeEqual(signature, await sign(payload, secret))) return null;

  try {
    const data = JSON.parse(decoder.decode(fromBase64Url(payload))) as Partial<SessionUser> & {
      exp?: number;
    };
    const role = parseRole(String(data.role ?? ""));
    if (!role || !data.email || !data.exp || data.exp <= Date.now()) return null;

    return {
      email: String(data.email),
      name: String(data.name ?? data.email),
      role,
      via: data.via === "password" ? "password" : "google",
    };
  } catch {
    return null;
  }
}

export function passwordMatches(input: string, expected: string): boolean {
  return expected.length > 0 && safeEqual(input, expected);
}

/** Constant-time comparison for shared secrets, such as the scheduled-run key. */
export function secretsMatch(input: string, expected: string): boolean {
  return expected.length > 0 && safeEqual(input, expected);
}

/** Signs short-lived values such as the OAuth state parameter. */
export async function signValue(value: string, secret: string): Promise<string> {
  return sign(value, secret);
}

export async function verifyValue(value: string, signature: string, secret: string): Promise<boolean> {
  return safeEqual(signature, await sign(value, secret));
}
