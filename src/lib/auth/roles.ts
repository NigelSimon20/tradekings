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

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
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
