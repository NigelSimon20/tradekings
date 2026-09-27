/**
 * Who may do what.
 *
 * Roles are set per person on the Users tab of the Google Sheet, so access is
 * managed where everything else about this system is managed — no redeploy, no
 * developer. Managers can be switched on simply by adding a row.
 */
export const ROLES = ["Administrator", "HR", "Manager"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  /** See every employee in the database. */
  "viewAll",
  /** See only the employees who report to you. */
  "viewOwn",
  /** Create, edit and import contracts. */
  "editContracts",
  /** Download the database. */
  "exportData",
  /** Run a system check or send the weekly reports by hand. */
  "runReports",
  /** Change how the system is set up. */
  "manageSystem",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  Administrator: ["viewAll", "editContracts", "exportData", "runReports", "manageSystem"],
  HR: ["viewAll", "editContracts", "exportData", "runReports"],
  // A manager sees the same employees their weekly email covers, and nothing else.
  Manager: ["viewOwn"],
};

/** `role` is null for someone who only has access to the billboard tracker. */
export function can(role: Role | null, permission: Permission): boolean {
  return role !== null && ROLE_PERMISSIONS[role].includes(permission);
}

/** Matches a role however it was typed in the sheet. */
export function parseRole(value: string): Role | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith("admin")) return "Administrator";
  if (text.startsWith("hr") || text.includes("human")) return "HR";
  if (text.startsWith("manager") || text.startsWith("line")) return "Manager";
  return null;
}

export function describeRole(role: Role): string {
  switch (role) {
    case "Administrator":
      return "Full access, including how the system is set up.";
    case "HR":
      return "The whole database: capture contracts, import, export and run reports.";
    case "Manager":
      return "Only their own employees, read-only.";
  }
}

/**
 * The billboard tracker has its own access level, set in the Users tab's
 * Billboards column, so marketing staff can be given billboards without seeing
 * employee contracts, and HR without seeing leases. Blank means no access.
 */
export const BILLBOARD_ROLES = ["Administrator", "Editor", "Viewer"] as const;
export type BillboardRole = (typeof BILLBOARD_ROLES)[number];

export const BILLBOARD_PERMISSIONS = [
  /** Open the map, dashboard and profiles. */
  "viewBillboards",
  /** Add and edit billboards, campaigns, maintenance and documents. */
  "editBillboards",
  /** Archive billboards, remove documents and set up the billboard sheet. */
  "manageBillboards",
] as const;
export type BillboardPermission = (typeof BILLBOARD_PERMISSIONS)[number];

const BILLBOARD_ROLE_PERMISSIONS: Record<BillboardRole, readonly BillboardPermission[]> = {
  Administrator: ["viewBillboards", "editBillboards", "manageBillboards"],
  Editor: ["viewBillboards", "editBillboards"],
  Viewer: ["viewBillboards"],
};

export function canBillboards(role: BillboardRole | null, permission: BillboardPermission): boolean {
  return role !== null && BILLBOARD_ROLE_PERMISSIONS[role].includes(permission);
}

/** Matches a billboard access level however it was typed in the sheet. */
export function parseBillboardRole(value: string): BillboardRole | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith("admin")) return "Administrator";
  if (text.startsWith("edit") || text.startsWith("standard")) return "Editor";
  if (text.startsWith("view") || text.startsWith("read")) return "Viewer";
  return null;
}

export function describeBillboardRole(role: BillboardRole): string {
  switch (role) {
    case "Administrator":
      return "Everything, including archiving billboards and removing documents.";
    case "Editor":
      return "View everything and add or update billboards, campaigns, maintenance and documents.";
    case "Viewer":
      return "View the map, dashboard and profiles, read-only.";
  }
}

export type AccessDecision =
  | { ok: true; role: Role | null; billboardRole: BillboardRole | null }
  | { ok: false; reason: string };

/**
 * Turns a Users-tab row's Role and Billboards cells into access. Either may be
 * blank, but not both, and a value that is not recognised is refused rather
 * than quietly ignored, so a typo never grants or hides access by surprise.
 */
export function resolveAccess(roleText: string, billboardText: string): AccessDecision {
  const role = parseRole(roleText);
  const billboardRole = parseBillboardRole(billboardText);

  if (roleText.trim() && !role) {
    return {
      ok: false,
      reason: `The role "${roleText}" is not recognised. It should be Administrator, HR or Manager, or blank.`,
    };
  }
  if (billboardText.trim() && !billboardRole) {
    return {
      ok: false,
      reason: `The billboard access "${billboardText}" is not recognised. It should be Administrator, Editor or Viewer, or blank.`,
    };
  }
  if (!role && !billboardRole) {
    return {
      ok: false,
      reason: "Your account has not been given access to either tracker yet. Ask an administrator.",
    };
  }
  return { ok: true, role, billboardRole };
}
