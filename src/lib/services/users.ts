import "server-only";

import { planUserChange, userAdminRights, type UserChangeRequest } from "@/lib/auth/user-admin";
import { getRepository } from "@/lib/data";
import { getCurrentUser, getRoleTable, listSignInUsers } from "@/lib/services/auth";

/**
 * Changes someone's access from inside the app, on the rules in
 * `lib/auth/user-admin.ts`, writing to the Users tab the tracker already reads.
 */
export async function saveSignInUser(request: UserChangeRequest): Promise<string> {
  const editor = await getCurrentUser();
  if (!editor) throw new Error("Sign in again to change access.");

  const repository = getRepository();
  const [users, roles] = await Promise.all([repository.listUsers(), getRoleTable()]);
  const existing = users.find((user) => user.email === request.email.trim().toLowerCase());

  const plan = planUserChange(editor, existing, request, roles);
  if (!plan.ok) throw new Error(plan.reason);
  if (!plan.created && Object.keys(plan.change).length === 1) return "Nothing changed.";

  await repository.saveUser(plan.change);
  return plan.created
    ? `${plan.change.email} added. They can sign in straight away.`
    : `Access for ${plan.change.email} updated. It applies within about 30 seconds.`;
}

/** Everything the people list on either settings page needs, for the person looking at it. */
export async function loadUsersEditor() {
  const [editor, users, roles] = await Promise.all([getCurrentUser(), listSignInUsers(), getRoleTable()]);
  return {
    users: users.map((user) => ({
      email: user.email,
      name: user.name,
      role: user.parsedRole ?? user.role,
      roleKnown: !user.role.trim() || user.parsedRole !== null,
      billboards: user.parsedBillboardRole ?? user.billboards,
      billboardsKnown: !user.billboards.trim() || user.parsedBillboardRole !== null,
      licenses: user.parsedLicenseRole ?? user.licenses,
      licensesKnown: !user.licenses.trim() || user.parsedLicenseRole !== null,
      active: user.active,
      lastSignedIn: user.lastSignedIn,
    })),
    contractRoles: roles.contracts.map((role) => role.name),
    billboardRoles: roles.billboards.map((role) => role.name),
    licenseRoles: roles.licenses.map((role) => role.name),
    rights: editor ? userAdminRights(editor) : { contracts: false, billboards: false, licenses: false, active: false },
    currentEmail: editor?.email ?? "",
    /** Sample data has no Users tab to edit. */
    editable: getRepository().kind === "google-sheets",
  };
}
