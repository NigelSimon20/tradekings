"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getConfig } from "@/lib/config/env";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  passwordMatches,
} from "@/lib/auth/session";

export interface LoginState {
  error: string;
}

export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const config = getConfig();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!passwordMatches(password, config.auth.password)) {
    return { error: "That password is not correct." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(config.auth.secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect(next.startsWith("/") ? next : "/");
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
