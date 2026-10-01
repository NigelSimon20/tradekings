import { NOT_ALLOWED, can, canBillboards, canLicenses, findRole, type Access, type RoleTable } from "@/lib/auth/roles";
import type { SheetUser } from "@/lib/data/sheet-schema";
import type { UserAccessInput } from "@/lib/data/repository";

/**
 * Who may change whose access, from inside the app.
 *
 *  - The Contracts column: Contract Tracker administrators ("Manage settings").
 *  - The Billboards column: Billboard Tracker administrators ("Manage setup").
 *  - The Licenses column: License Tracker administrators ("Manage setup").
 *  - Active switches someone off for every app, so it needs all three.
 *  - Nobody changes their own row here, so an administrator cannot lock
 *    themselves out by accident; another administrator has to do it.
 */
export interface UserAdminRights {
  contracts: boolean;
  billboards: boolean;
  licenses: boolean;
  active: boolean;
}

export function userAdminRights(
  editor: Pick<Access, "permissions" | "billboardPermissions" | "licensePermissions">,
): UserAdminRights {
  const contracts = can(editor, "manageSystem");
  const billboards = canBillboards(editor, "manageBillboards");
  const licenses = canLicenses(editor, "manageLicenses");
  return { contracts, billboards, licenses, active: contracts && billboards && licenses };
}

export interface UserChangeRequest {
  email: string;
  name?: string;
  role?: string;
  billboards?: string;
  licenses?: string;
  active?: boolean;
}

export type UserChangePlan = { ok: true; change: UserAccessInput; created: boolean } | { ok: false; reason: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function planUserChange(
  editor: Pick<Access, "permissions" | "billboardPermissions" | "licensePermissions"> & { email: string },
  existing: SheetUser | undefined,
  request: UserChangeRequest,
  roles: RoleTable,
): UserChangePlan {
  const rights = userAdminRights(editor);
  if (!rights.contracts && !rights.billboards && !rights.licenses) {
    return { ok: false, reason: "Only an administrator can change who may sign in." };
  }

  const email = request.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, reason: "Enter the person's full Google email address." };
  if (email === editor.email.trim().toLowerCase()) {
    return { ok: false, reason: "You cannot change your own access. Ask another administrator." };
  }

  const change: UserAccessInput = { email };
  const refuse = (what: string) => ({ ok: false as const, reason: `Your account cannot change ${what}.` });

  // A column is only written when it changes, and only by someone allowed to.
  const role = (
    requested: string | undefined,
    current: string,
    allowed: boolean,
    table: RoleTable["contracts"] | RoleTable["billboards"] | RoleTable["licenses"],
    label: string,
  ): { value?: string; error?: string } => {
    if (requested === undefined) return {};
    const wanted = requested.trim() ? findRole(requested, table)?.name : "";
    if (wanted === undefined) return { error: `"${requested}" is not a ${label} role.` };
    const currentName = current.trim() ? (findRole(current, table)?.name ?? current) : "";
    if (wanted === currentName) return {};
    if (!allowed) return { error: `people's ${label} access` };
    return { value: wanted };
  };

  const contracts = role(request.role, existing?.role ?? "", rights.contracts, roles.contracts, "Contract Tracker");
  if (contracts.error) return contracts.error.startsWith('"') ? { ok: false, reason: contracts.error } : refuse(contracts.error);
  if (contracts.value !== undefined) change.role = contracts.value;

  const billboards = role(request.billboards, existing?.billboards ?? "", rights.billboards, roles.billboards, "Billboard Tracker");
  if (billboards.error) return billboards.error.startsWith('"') ? { ok: false, reason: billboards.error } : refuse(billboards.error);
  if (billboards.value !== undefined) change.billboards = billboards.value;

  const licenses = role(request.licenses, existing?.licenses ?? "", rights.licenses, roles.licenses, "License Tracker");
  if (licenses.error) return licenses.error.startsWith('"') ? { ok: false, reason: licenses.error } : refuse(licenses.error);
  if (licenses.value !== undefined) change.licenses = licenses.value;

  if (request.active !== undefined && request.active !== (existing?.active ?? true)) {
    if (!rights.active) return refuse("whether someone is active — that affects every app");
    change.active = request.active;
  }

  const name = request.name?.trim();
  if (name !== undefined && name !== (existing?.name === existing?.email ? "" : (existing?.name ?? ""))) {
    change.name = name;
  }

  if (!existing) {
    const grants = (value: string | undefined) => Boolean(value && value !== NOT_ALLOWED);
    if (!grants(change.role) && !grants(change.billboards) && !grants(change.licenses)) {
      return { ok: false, reason: "Give the new person a role in at least one app." };
    }
    return { ok: true, change, created: true };
  }
  return { ok: true, change, created: false };
}
