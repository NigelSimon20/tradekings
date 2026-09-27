import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/data";
import {
  can,
  canBillboards,
  parseBillboardRole,
  parseRole,
  resolveAccess,
  type BillboardPermission,
  type Permission,
} from "@/lib/auth/roles";
import {
  SESSION_COOKIE,
  readSessionToken,
  type SessionUser,
} from "@/lib/auth/session";
import { loadSnapshot } from "@/lib/services/contracts";

export interface SignInOutcome {
  user: SessionUser | null;
  /** Why the person was turned away, for the sign-in page. */
  reason?: string;
}

/**
 * Decides whether an email address may sign in, and with what role.
 *
 * The Users tab of the users spreadsheet is the list. It is kept apart from the
 * contracts spreadsheet so the people who edit contracts cannot grant access. `ADMIN_EMAILS` is the way back in if that tab
 * is ever emptied or mistyped — without it a bad edit would lock everyone out.
 */
export async function resolveSignIn(
  email: string,
  name: string,
  via: SessionUser["via"],
): Promise<SignInOutcome> {
  const address = email.trim().toLowerCase();
  if (!address) return { user: null, reason: "That account has no email address." };

  const config = getConfig();

  if (config.auth.bootstrapAdmins.includes(address)) {
    return {
      user: {
        email: address,
        name: name || address,
        role: "Administrator",
        billboardRole: "Administrator",
        via,
      },
    };
  }

  let users: Awaited<ReturnType<ReturnType<typeof getRepository>["listUsers"]>> = [];
  try {
    users = await getRepository().listUsers();
  } catch {
    return {
      user: null,
      reason: "The list of people who may sign in could not be read. Try again shortly.",
    };
  }

  const match = users.find((user) => user.email === address);
  if (!match) {
    return {
      user: null,
      reason: `${address} is not on the list of people who may use the tracker. Ask an administrator to add you on the Users tab.`,
    };
  }
  if (!match.active) {
    return { user: null, reason: "That account has been switched off." };
  }

  const access = resolveAccess(match.role, match.billboards);
  if (!access.ok) return { user: null, reason: access.reason };

  // Best effort: a failed stamp must never block a valid sign-in.
  try {
    await getRepository().recordSignIn(match, new Date().toISOString());
  } catch {
    // Ignored on purpose.
  }

  return {
    user: {
      email: address,
      name: match.name || name || address,
      role: access.role,
      billboardRole: access.billboardRole,
      via,
    },
  };
}

/** The signed-in person for this request, or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const config = getConfig();
  if (!config.auth.enabled) {
    // With no sign-in configured the tracker is open, and whoever is using it
    // is treated as an administrator.
    return {
      email: "",
      name: "Administrator",
      role: "Administrator",
      billboardRole: "Administrator",
      via: "password",
    };
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSessionToken(token, config.auth.secret);
});

/**
 * The contracts this person may see.
 *
 * A manager sees exactly the employees their weekly email covers — the filter
 * is the Manager Email column, the same one the reports use — so there is one
 * definition of "my team" in the system rather than two.
 */
export async function loadVisibleSnapshot() {
  const [user, snapshot] = await Promise.all([getCurrentUser(), loadSnapshot()]);

  if (!user || can(user.role, "viewAll")) return { ...snapshot, user };

  const email = user.email.trim().toLowerCase();
  const mine = (contract: { managerEmail: string }) =>
    contract.managerEmail.trim().toLowerCase() === email;

  return {
    ...snapshot,
    contracts: snapshot.contracts.filter(mine),
    latest: snapshot.latest.filter(mine),
    user,
  };
}

/** Stops a page rendering for someone who may not see it. */
export async function requireViewer(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Someone with billboards only has nothing to see on the contract side.
  if (!user.role) redirect(user.billboardRole ? "/billboards" : "/login");
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}

/** The billboard tracker's equivalent of `requireViewer`. */
export async function requireBillboardViewer(permission: BillboardPermission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.billboardRole) redirect(user.role ? "/?denied=1" : "/login");
  if (!canBillboards(user.billboardRole, permission)) redirect("/billboards?denied=1");
  return user;
}

/** Guard for API routes: returns a refusal, or null when the caller may proceed. */
export async function guardApi(permission: Permission): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (!can(user.role, permission)) {
    return Response.json(
      { ok: false, error: "Your account does not have permission to do that." },
      { status: 403 },
    );
  }

  return null;
}

/** Everyone on the Users tab, for the Rules & settings page. */
export const listSignInUsers = cache(async () => {
  try {
    const users = await getRepository().listUsers();
    return users.map((user) => ({
      ...user,
      parsedRole: parseRole(user.role),
      parsedBillboardRole: parseBillboardRole(user.billboards),
    }));
  } catch {
    return [];
  }
});
