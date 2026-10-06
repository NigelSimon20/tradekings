import { FULL_ACCESS, accessForRoles, resolveAccess, type Access, type RoleTable } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { SheetUser } from "@/lib/data/sheet-schema";

/**
 * Re-applies the Users tab and the roles tabs to someone who is already signed
 * in, on every request. Taking a person's access away, or unticking a
 * permission from their role, therefore applies within the read cache's ~30
 * seconds rather than when their sign-in expires, up to 12 hours later.
 *
 * `sheet` is null when the lists could not be read (Google briefly
 * unreachable): the session's role names are then applied to the built-in
 * roles table, so an outage signs nobody out.
 *
 * An ADMIN_EMAILS address follows its row like anyone else — so roles can be
 * tried out with it — and falls back to full access only when that row gives
 * it nothing usable (missing, switched off, unrecognised, Not allowed
 * everywhere) or the sheet cannot be read. It can therefore never be locked
 * out, which is what it is for.
 */
export function refreshSessionAccess(
  session: SessionUser,
  sheet: { users: SheetUser[]; roles: RoleTable } | null,
  bootstrapAdmins: string[],
  fallbackRoles: RoleTable,
): SessionUser | null {
  const email = session.email.trim().toLowerCase();
  if (session.via === "google" && bootstrapAdmins.includes(email)) {
    const own = sheet ? accessFromRow(sheet, email) : null;
    return { ...session, ...(own ?? FULL_ACCESS) };
  }

  // The shared password has no row of its own; its session names its roles.
  if (session.via === "password" || sheet === null) {
    const roles = sheet?.roles ?? fallbackRoles;
    return { ...session, ...accessForRoles(session.role, session.billboardRole, roles, session.licenseRole, session.expatRole) };
  }

  const granted = accessFromRow(sheet, email);
  if (!granted) return null;
  const row = sheet.users.find((user) => user.email === email);
  return { ...session, name: row?.name || session.name, ...granted };
}

/** What someone's row on the Users tab gives them, or null when it gives nothing. */
export function accessFromRow(
  sheet: { users: SheetUser[]; roles: RoleTable },
  email: string,
): Access | null {
  const row = sheet.users.find((user) => user.email === email);
  if (!row || !row.active) return null;
  const decision = resolveAccess(row.role, row.billboards, sheet.roles, row.licenses, row.expats);
  if (!decision.ok) return null;
  const { ok, ...access } = decision;
  void ok;
  return access;
}
