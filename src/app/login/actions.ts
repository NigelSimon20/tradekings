"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  checkLoginAttempt,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/auth/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  passwordMatches,
} from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";

export interface LoginState {
  error: string;
}

/**
 * The shared-password fallback, for when Google sign-in is not set up — or as a
 * way back in if it ever stops working. Google sign-in is the main route.
 */
export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const config = getConfig();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!config.auth.password) {
    return { error: "Password sign-in is not available. Use Google sign-in." };
  }

  // Guessing a single shared password is worth an attacker's time, so attempts
  // are counted per caller.
  const requestHeaders = await headers();
  const caller =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";

  const limit = checkLoginAttempt(caller);
  if (!limit.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  if (!passwordMatches(password, config.auth.password)) {
    recordFailedLogin(caller);
    return { error: "That password is not correct." };
  }

  clearLoginAttempts(caller);

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    await createSessionToken(config.auth.secret, {
      email: "",
      name: "Administrator",
      role: "Administrator",
      via: "password",
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  );

  redirect(next.startsWith("/") ? next : "/");
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login?signedOut=1");
}
