import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { accessFromRow, refreshSessionAccess } from "@/lib/auth/access";
import { getConfig } from "@/lib/config/env";
import type { SheetUser } from "@/lib/data/sheet-schema";
import { getRepository } from "@/lib/data";
import {
  DEFAULT_ROLE_TABLE,
  FULL_ACCESS,
  can,
  canBillboards,
  canLicenses,
  findRole,
  resolveAccess,
  type BillboardPermission,
  type LicensePermission,
  type Permission,
  type RoleTable,
} from "@/lib/auth/roles";
import {
  SESSION_COOKIE,
  readSessionToken,
  type SessionUser,
} from "@/lib/auth/session";
import { canOpenProject, homeFor } from "@/lib/domain/projects";
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

  // ADMIN_EMAILS addresses follow their own row when it gives them access (so
  // roles can be tried with them) and are never refused otherwise.
  if (config.auth.bootstrapAdmins.includes(address)) {
    let own: ReturnType<typeof accessFromRow> = null;
    try {
      const [users, roles] = await Promise.all([getRepository().listUsers(), getRepository().readRoleTable()]);
      own = accessFromRow({ users, roles }, address);
    } catch {
      // Unreadable sheet: the escape hatch applies.
    }
    return { user: { email: address, name: name || address, via, ...(own ?? FULL_ACCESS) } };
  }

  let users: SheetUser[] = [];
  let roles: RoleTable = DEFAULT_ROLE_TABLE;
  try {
    [users, roles] = await Promise.all([getRepository().listUsers(), getRepository().readRoleTable()]);
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

  const access = resolveAccess(match.role, match.billboards, roles, match.licenses);
  if (!access.ok) return { user: null, reason: access.reason };
  const { ok, ...granted } = access;
  void ok;

  // Best effort: a failed stamp must never block a valid sign-in.
  try {
    await getRepository().recordSignIn(match, new Date().toISOString());
  } catch {
    // Ignored on purpose.
  }

  return {
    user: { email: address, name: match.name || name || address, via, ...granted },
  };
}

/**
 * The signed-in person for this request, or null. The cookie says who they
 * are; the Users tab, re-read here (from the short read cache), says what they
 * may open *now* — so taking access away on the sheet applies within about 30
 * seconds, not when their sign-in expires.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const config = getConfig();
  if (!config.auth.enabled) {
    // With no sign-in configured the tracker is open, and whoever is using it
    // is treated as an administrator.
    return { email: "", name: "Administrator", via: "password", ...FULL_ACCESS };
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token, config.auth.secret);
  if (!session) return null;

  // Sample data has no Users tab to check against; its sessions stand as issued.
  const repository = getRepository();
  let sheet: { users: SheetUser[]; roles: RoleTable } | null = null;
  if (repository.kind === "google-sheets") {
    try {
      const [users, roles] = await Promise.all([repository.listUsers(), repository.readRoleTable()]);
      sheet = { users, roles };
    } catch (error) {
      console.warn("Could not re-check access against the Users tab:", (error as Error).message);
    }
  }
  return refreshSessionAccess(session, sheet, config.auth.bootstrapAdmins, DEFAULT_ROLE_TABLE);
});

/**
 * The contracts this person may see.
 *
 * A manager sees exactly the employees their weekly email covers — the filter
 * is the Manager Email column, the same one the reports use — so there is one
 * definition of "my team" in the system rather than two.
 */
export async function loadVisibleSnapshot() {
  // Checked here, next to the data, not only in the layout: layouts do not
  // re-run on client-side navigation, so they cannot be the only gate.
  const [user, snapshot] = await Promise.all([requireContractUser(), loadSnapshot()]);

  if (can(user, "viewAll")) return { ...snapshot, user };

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

/** Anyone with Contract Tracker access; sends everyone else to sign in or to their own app. */
export async function requireContractUser(): Promise<SessionUser & { role: NonNullable<SessionUser["role"]> }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.role || !canOpenProject(user, "contracts")) {
    redirect(homeFor(user, "contracts"));
  }
  return { ...user, role: user.role };
}

/** Stops a page rendering for someone who may not see it. */
export async function requireViewer(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Someone with billboards only has nothing to see on the contract side.
  if (!canOpenProject(user, "contracts")) redirect(homeFor(user, "contracts"));
  if (!can(user, permission)) redirect("/?denied=1");
  return user;
}

/** The billboard tracker's equivalent of `requireViewer`. */
export async function requireBillboardViewer(permission: BillboardPermission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenProject(user, "billboards")) redirect(homeFor(user, "billboards", { denied: true }));
  if (!canBillboards(user, permission)) redirect("/billboards?denied=1");
  return user;
}

/** Guard for API routes: returns a refusal, or null when the caller may proceed. */
export async function guardApi(permission: Permission): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (!can(user, permission)) {
    return Response.json(
      { ok: false, error: "Your account does not have permission to do that." },
      { status: 403 },
    );
  }

  return null;
}

/** The License Tracker's equivalent of `requireViewer`. */
export async function requireLicenseViewer(permission: LicensePermission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canOpenProject(user, "licenses")) redirect(homeFor(user, "licenses", { denied: true }));
  if (!canLicenses(user, permission)) redirect("/licenses?denied=1");
  return user;
}

/** `guardApi` for the License Tracker's routes. */
export async function guardLicenseApi(permission: LicensePermission): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!canLicenses(user, permission)) {
    return Response.json(
      { ok: false, error: "Your account does not have permission to do that." },
      { status: 403 },
    );
  }
  return null;
}

/** `guardApi` for the billboard tracker's routes. */
export async function guardBillboardApi(permission: BillboardPermission): Promise<Response | null> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });

  if (!canBillboards(user, permission)) {
    return Response.json(
      { ok: false, error: "Your account does not have permission to do that." },
      { status: 403 },
    );
  }

  return null;
}

/**
 * What each role may do — the Contract Roles and Billboard Roles tabs, or the
 * built-in roles when they cannot be read — for the settings pages.
 */
export const getRoleTable = cache(async (): Promise<RoleTable> => {
  try {
    return await getRepository().readRoleTable();
  } catch {
    return DEFAULT_ROLE_TABLE;
  }
});

/** Everyone on the Users tab, for the Rules & settings page. */
export const listSignInUsers = cache(async () => {
  try {
    const [users, roles] = await Promise.all([getRepository().listUsers(), getRoleTable()]);
    return users.map((user) => ({
      ...user,
      parsedRole: findRole(user.role, roles.contracts)?.name ?? null,
      parsedBillboardRole: findRole(user.billboards, roles.billboards)?.name ?? null,
      parsedLicenseRole: findRole(user.licenses, roles.licenses)?.name ?? null,
    }));
  } catch {
    return [];
  }
});
