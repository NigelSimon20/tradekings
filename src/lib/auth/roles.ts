/**
 * Who may do what.
 *
 * Each person's role is set on the Users tab, and what each role may do is set
 * on the Contract Roles and Billboard Roles tabs of the same spreadsheet — a
 * tick per permission — so administrators can change permissions, and add
 * roles, without a developer. The defaults below apply until those tabs exist,
 * or whenever they cannot be read.
 *
 * Administrator always has every permission, whatever its row says, so an
 * untick can never lock the administrators out of fixing it. "Not allowed" is
 * its opposite: always nothing, so choosing it on the Users tab keeps that
 * person out of that app, and no tick can change that.
 */

export interface PermissionInfo<P extends string> {
  key: P;
  /** The column heading on the roles tab. */
  label: string;
  description: string;
}

export const PERMISSIONS = [
  "viewAll",
  "viewOwn",
  "editContracts",
  "exportData",
  "runReports",
  "manageSystem",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: PermissionInfo<Permission>[] = [
  { key: "viewAll", label: "See all employees", description: "Open every contract in the database." },
  {
    key: "viewOwn",
    label: "See own team only",
    description: "Open only the employees whose Manager Email is theirs — the same list as their weekly email.",
  },
  { key: "editContracts", label: "Add & edit contracts", description: "Capture, edit, renew and import contracts." },
  { key: "exportData", label: "Export data", description: "Download the database as a spreadsheet." },
  { key: "runReports", label: "Run reports", description: "Run a system check or send the weekly reports by hand." },
  {
    key: "manageSystem",
    label: "Manage settings",
    description: "Prepare the Google Sheet and change how the tracker is set up.",
  },
];

export const BILLBOARD_PERMISSIONS = [
  "viewBillboards",
  "editBillboards",
  "archiveBillboards",
  "removeDocuments",
  "manageBillboards",
] as const;
export type BillboardPermission = (typeof BILLBOARD_PERMISSIONS)[number];

export const BILLBOARD_PERMISSION_INFO: PermissionInfo<BillboardPermission>[] = [
  { key: "viewBillboards", label: "See billboards", description: "Open the map, dashboard, list and profiles." },
  {
    key: "editBillboards",
    label: "Add & edit billboards",
    description: "Add and update billboards, campaigns, maintenance, photos and documents.",
  },
  {
    key: "archiveBillboards",
    label: "Archive billboards",
    description: "Take a billboard out of use (its history is kept) and restore it.",
  },
  {
    key: "removeDocuments",
    label: "Remove documents",
    description: "Hide a photo or document from a profile (the record is kept).",
  },
  {
    key: "manageBillboards",
    label: "Manage setup",
    description: "Prepare the billboard sheet, connect photo storage and see who has access.",
  },
];

export const LICENSE_PERMISSIONS = [
  "viewLicenses",
  "editLicenses",
  "manageAssets",
  "exportLicenses",
  "removeLicenseDocuments",
  "manageLicenses",
] as const;
export type LicensePermission = (typeof LICENSE_PERMISSIONS)[number];

export const LICENSE_PERMISSION_INFO: PermissionInfo<LicensePermission>[] = [
  { key: "viewLicenses", label: "See licenses", description: "Open the dashboard, map, register and every license and asset." },
  {
    key: "editLicenses",
    label: "Add & renew licenses",
    description: "Add and update licenses, upload documents and record renewals.",
  },
  {
    key: "manageAssets",
    label: "Manage assets & locations",
    description: "Add and update warehouses, sites, vehicles, equipment and their locations.",
  },
  { key: "exportLicenses", label: "Export", description: "Download the license register as a spreadsheet." },
  {
    key: "removeLicenseDocuments",
    label: "Remove documents",
    description: "Hide a document from a license or asset (the record is kept).",
  },
  {
    key: "manageLicenses",
    label: "Manage setup",
    description: "Prepare the license sheet, set reminder days and connect document storage.",
  },
];

export interface RoleDefinition<P extends string> {
  name: string;
  description: string;
  permissions: P[];
  /** Administrator: always everything, whatever the tab says. */
  locked: boolean;
  /** "Not allowed": always nothing, whatever the tab says. */
  blocks: boolean;
}

export interface RoleTable {
  contracts: RoleDefinition<Permission>[];
  billboards: RoleDefinition<BillboardPermission>[];
  licenses: RoleDefinition<LicensePermission>[];
}

export const ADMINISTRATOR = "Administrator";
/** Chosen on the Users tab to keep someone out of an app. */
export const NOT_ALLOWED = "Not allowed";

function notAllowed<P extends string>(app: string): RoleDefinition<P> {
  return {
    name: NOT_ALLOWED,
    description: `Cannot open ${app}, whatever else is set.`,
    permissions: [],
    locked: false,
    blocks: true,
  };
}

export const DEFAULT_ROLE_TABLE: RoleTable = {
  contracts: [
    {
      name: ADMINISTRATOR,
      description: "Full access, including how the system is set up.",
      permissions: [...PERMISSIONS],
      locked: true,
      blocks: false,
    },
    {
      name: "HR",
      description: "The whole database: capture contracts, import, export and run reports.",
      permissions: ["viewAll", "editContracts", "exportData", "runReports"],
      locked: false,
      blocks: false,
    },
    {
      name: "Manager",
      description: "Only their own employees, read-only.",
      permissions: ["viewOwn"],
      locked: false,
      blocks: false,
    },
    notAllowed("the Contract Tracker"),
  ],
  billboards: [
    {
      name: ADMINISTRATOR,
      description: "Everything, including archiving billboards, removing documents and setup.",
      permissions: [...BILLBOARD_PERMISSIONS],
      locked: true,
      blocks: false,
    },
    {
      name: "Editor",
      description: "View everything and add or update billboards, campaigns, maintenance and documents.",
      permissions: ["viewBillboards", "editBillboards"],
      locked: false,
      blocks: false,
    },
    {
      name: "Viewer",
      description: "View the map, dashboard and profiles, read-only.",
      permissions: ["viewBillboards"],
      locked: false,
      blocks: false,
    },
    notAllowed("the Billboard Tracker"),
  ],
  licenses: [
    {
      name: ADMINISTRATOR,
      description: "Everything, including setup, reminder days and document storage.",
      permissions: [...LICENSE_PERMISSIONS],
      locked: true,
      blocks: false,
    },
    {
      name: "Editor",
      description: "View everything; add and renew licenses, upload documents and manage assets.",
      permissions: ["viewLicenses", "editLicenses", "manageAssets", "exportLicenses"],
      locked: false,
      blocks: false,
    },
    {
      name: "Viewer",
      description: "View the dashboard, map, register and documents, read-only.",
      permissions: ["viewLicenses"],
      locked: false,
      blocks: false,
    },
    notAllowed("the License Tracker"),
  ],
};

/** What a signed-in person may do, worked out from their roles and the roles tabs. */
export interface Access {
  /** Contract Tracker role name; null when they have no Contract Tracker access. */
  role: string | null;
  /** Billboard Tracker role name; null when they have no Billboard Tracker access. */
  billboardRole: string | null;
  /** License Tracker role name; null when they have no License Tracker access. */
  licenseRole: string | null;
  permissions: Permission[];
  billboardPermissions: BillboardPermission[];
  licensePermissions: LicensePermission[];
}

export function can(
  user: Pick<Access, "permissions"> | null | undefined,
  permission: Permission,
): boolean {
  return Boolean(user?.permissions.includes(permission));
}

export function canBillboards(
  user: Pick<Access, "billboardPermissions"> | null | undefined,
  permission: BillboardPermission,
): boolean {
  return Boolean(user?.billboardPermissions.includes(permission));
}

export function canLicenses(
  user: Pick<Access, "licensePermissions"> | null | undefined,
  permission: LicensePermission,
): boolean {
  return Boolean(user?.licensePermissions?.includes(permission));
}

/** How the built-in roles used to be typed, so existing sheets keep working. */
const ALIASES: [RegExp, string][] = [
  [/^admin/, ADMINISTRATOR],
  [/^hr\b|^hr$|human/, "HR"],
  [/^manager|^line/, "Manager"],
  [/^edit|^standard/, "Editor"],
  [/^view|^read/, "Viewer"],
  [/^not ?allowed|^no ?access|^none$|^blocked/, NOT_ALLOWED],
];

/** Finds a role by name (any case), or by the old loose spellings of the built-in ones. */
export function findRole<P extends string>(text: string, roles: RoleDefinition<P>[]): RoleDefinition<P> | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  const exact = roles.find((role) => role.name.trim().toLowerCase() === value);
  if (exact) return exact;
  for (const [pattern, name] of ALIASES) {
    if (pattern.test(value)) return roles.find((role) => role.name === name) ?? null;
  }
  return null;
}

/** A role's permissions, with Administrator always complete. */
function permissionsOf<P extends string>(role: RoleDefinition<P> | null, all: readonly P[]): P[] {
  if (!role || role.blocks) return [];
  return role.locked ? [...all] : [...role.permissions];
}

/** Access for role names already decided (e.g. carried in a session), against a table. */
export function accessForRoles(
  role: string | null,
  billboardRole: string | null,
  table: RoleTable,
  licenseRole: string | null = null,
): Access {
  const contract = role ? findRole(role, table.contracts) : null;
  const billboard = billboardRole ? findRole(billboardRole, table.billboards) : null;
  const license = licenseRole ? findRole(licenseRole, table.licenses) : null;
  return {
    role: contract?.name ?? null,
    billboardRole: billboard?.name ?? null,
    licenseRole: license?.name ?? null,
    permissions: permissionsOf(contract, PERMISSIONS),
    billboardPermissions: permissionsOf(billboard, BILLBOARD_PERMISSIONS),
    licensePermissions: permissionsOf(license, LICENSE_PERMISSIONS),
  };
}

export const FULL_ACCESS: Access = accessForRoles(ADMINISTRATOR, ADMINISTRATOR, DEFAULT_ROLE_TABLE, ADMINISTRATOR);

export type AccessDecision = ({ ok: true } & Access) | { ok: false; reason: string };

const names = (roles: RoleDefinition<string>[]) => roles.map((role) => role.name).join(", ");

/**
 * Turns a Users-tab row's Contracts, Billboards and Licenses cells into access.
 * Any may be blank, but not all, and a value that is not a role on the roles tab is
 * refused rather than quietly ignored, so a typo never grants or hides access
 * by surprise. A role that cannot open an app (no "See…" permission ticked)
 * counts as no access to that app.
 */
export function resolveAccess(
  roleText: string,
  billboardText: string,
  table: RoleTable = DEFAULT_ROLE_TABLE,
  licenseText = "",
): AccessDecision {
  if (roleText.trim() && !findRole(roleText, table.contracts)) {
    return {
      ok: false,
      reason: `The Contract Tracker role "${roleText}" is not on the Contract Roles tab. It should be one of ${names(table.contracts)}, or blank.`,
    };
  }
  if (billboardText.trim() && !findRole(billboardText, table.billboards)) {
    return {
      ok: false,
      reason: `The Billboard Tracker role "${billboardText}" is not on the Billboard Roles tab. It should be one of ${names(table.billboards)}, or blank.`,
    };
  }

  if (licenseText.trim() && !findRole(licenseText, table.licenses)) {
    return {
      ok: false,
      reason: `The License Tracker role "${licenseText}" is not on the License Roles tab. It should be one of ${names(table.licenses)}, or blank.`,
    };
  }

  const access = accessForRoles(roleText, billboardText, table, licenseText);
  const opensContracts = can(access, "viewAll") || can(access, "viewOwn");
  const opensBillboards = canBillboards(access, "viewBillboards");
  const opensLicenses = canLicenses(access, "viewLicenses");
  if (!opensContracts && !opensBillboards && !opensLicenses) {
    return {
      ok: false,
      reason: "Your account has not been given access to any app yet. Ask an administrator.",
    };
  }
  return {
    ok: true,
    ...access,
    role: opensContracts ? access.role : null,
    permissions: opensContracts ? access.permissions : [],
    billboardRole: opensBillboards ? access.billboardRole : null,
    billboardPermissions: opensBillboards ? access.billboardPermissions : [],
    licenseRole: opensLicenses ? access.licenseRole : null,
    licensePermissions: opensLicenses ? access.licensePermissions : [],
  };
}

/**
 * Reads a roles tab: a heading row (Role, Description, then one column per
 * permission, matched by its label) and a row per role with a tick for each
 * permission it has. Returns null when the tab holds nothing usable, so the
 * defaults apply. Administrator is always present and always complete.
 */
export function parseRoleTab<P extends string>(
  values: unknown[][] | null,
  catalogue: PermissionInfo<P>[],
): RoleDefinition<P>[] | null {
  if (!values?.length) return null;
  const normalise = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const header = values[0].map(normalise);
  const columns = catalogue
    .map((permission) => ({
      key: permission.key,
      at: header.findIndex((cell) => cell === normalise(permission.label) || cell === normalise(permission.key)),
    }))
    .filter((column) => column.at !== -1);
  if (!columns.length) return null;

  const ticked = (value: unknown) =>
    value === true || ["true", "yes", "y", "1", "x", "✓", "✔"].includes(String(value ?? "").trim().toLowerCase());

  const seen = new Set<string>();
  const roles: RoleDefinition<P>[] = [];
  for (const row of values.slice(1)) {
    const name = String(row?.[0] ?? "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const locked = name.toLowerCase() === ADMINISTRATOR.toLowerCase();
    const blocks = name.toLowerCase() === NOT_ALLOWED.toLowerCase();
    roles.push({
      name: locked ? ADMINISTRATOR : blocks ? NOT_ALLOWED : name,
      description: String(row?.[1] ?? "").trim(),
      permissions: locked
        ? catalogue.map((permission) => permission.key)
        : blocks
          ? []
          : columns.filter((column) => ticked(row?.[column.at])).map((column) => column.key),
      locked,
      blocks,
    });
  }

  if (!roles.some((role) => role.locked)) {
    roles.unshift({
      name: ADMINISTRATOR,
      description: "Full access.",
      permissions: catalogue.map((permission) => permission.key),
      locked: true,
      blocks: false,
    });
  }
  if (!roles.some((role) => role.blocks)) roles.push(notAllowed("this app"));
  return roles;
}
