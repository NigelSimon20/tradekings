import { describe, expect, it } from "vitest";

import {
  BILLBOARD_PERMISSION_INFO,
  DEFAULT_ROLE_TABLE,
  PERMISSION_INFO,
  accessForRoles,
  can,
  canBillboards,
  parseRoleTab,
  resolveAccess,
  type RoleTable,
} from "@/lib/auth/roles";

const header = ["Role", "Description", ...PERMISSION_INFO.map((permission) => permission.label)];
const tick = (...keys: string[]) => PERMISSION_INFO.map((permission) => keys.includes(permission.key));

describe("access from the Users tab", () => {
  it("gives contracts and billboards independently", () => {
    expect(resolveAccess("HR", "")).toMatchObject({ ok: true, role: "HR", billboardRole: null, billboardPermissions: [] });
    expect(resolveAccess("", "Editor")).toMatchObject({ ok: true, role: null, billboardRole: "Editor", permissions: [] });
    expect(resolveAccess("Administrator", "Viewer")).toMatchObject({
      ok: true,
      role: "Administrator",
      billboardRole: "Viewer",
    });
  });

  it("still reads the old loose spellings of the built-in roles", () => {
    expect(resolveAccess("", "standard user")).toMatchObject({ billboardRole: "Editor" });
    expect(resolveAccess("", " view only ")).toMatchObject({ billboardRole: "Viewer" });
    expect(resolveAccess("hr officer", "")).toMatchObject({ role: "HR" });
    expect(resolveAccess("ADMIN", "")).toMatchObject({ role: "Administrator" });
  });

  it("refuses a row with no access to either app", () => {
    expect(resolveAccess("", "")).toMatchObject({ ok: false });
  });

  it("refuses a role that is not on the roles tab rather than guessing", () => {
    expect(resolveAccess("Supervisor", "")).toMatchObject({ ok: false });
    expect(resolveAccess("HR", "Owner")).toMatchObject({ ok: false });
  });
});

describe("permissions", () => {
  it("gives a billboard-only person nothing on the contract side", () => {
    const access = accessForRoles(null, "Viewer", DEFAULT_ROLE_TABLE);
    expect(can(access, "viewAll")).toBe(false);
    expect(can(access, "viewOwn")).toBe(false);
    expect(can(null, "viewAll")).toBe(false);
  });

  it("keeps the built-in roles as they were", () => {
    const admin = accessForRoles(null, "Administrator", DEFAULT_ROLE_TABLE);
    const editor = accessForRoles(null, "Editor", DEFAULT_ROLE_TABLE);
    const viewer = accessForRoles(null, "Viewer", DEFAULT_ROLE_TABLE);
    expect(canBillboards(admin, "manageBillboards")).toBe(true);
    expect(canBillboards(admin, "archiveBillboards")).toBe(true);
    expect(canBillboards(editor, "editBillboards")).toBe(true);
    expect(canBillboards(editor, "removeDocuments")).toBe(false);
    expect(canBillboards(viewer, "editBillboards")).toBe(false);
    expect(canBillboards(viewer, "viewBillboards")).toBe(true);
    expect(can(accessForRoles("Manager", null, DEFAULT_ROLE_TABLE), "viewOwn")).toBe(true);
    expect(can(accessForRoles("HR", null, DEFAULT_ROLE_TABLE), "manageSystem")).toBe(false);
  });
});

describe("Not allowed", () => {
  it("keeps someone out of that app while leaving the other open", () => {
    expect(resolveAccess("Not allowed", "Editor")).toMatchObject({
      ok: true,
      role: null,
      permissions: [],
      billboardRole: "Editor",
    });
    expect(resolveAccess("HR", "not allowed")).toMatchObject({ ok: true, role: "HR", billboardRole: null });
  });

  it("refuses sign-in when both apps are Not allowed", () => {
    expect(resolveAccess("Not allowed", "Not allowed")).toMatchObject({ ok: false });
  });

  it("cannot be switched on by ticking boxes on its row", () => {
    const roles = parseRoleTab([header, ["Not allowed", "", ...tick("viewAll", "manageSystem")]], PERMISSION_INFO)!;
    const table: RoleTable = { ...DEFAULT_ROLE_TABLE, contracts: roles };
    expect(roles.find((role) => role.name === "Not allowed")).toMatchObject({ blocks: true, permissions: [] });
    expect(resolveAccess("Not allowed", "", table)).toMatchObject({ ok: false });
  });

  it("is always on offer, even when the row was deleted from the tab", () => {
    const roles = parseRoleTab([header, ["HR", "", ...tick("viewAll")]], PERMISSION_INFO)!;
    expect(roles.at(-1)).toMatchObject({ name: "Not allowed", blocks: true });
  });
});

describe("the roles tab", () => {
  it("reads a tick per permission, matching the columns by heading", () => {
    const roles = parseRoleTab(
      [
        header,
        ["Administrator", "Everything", ...tick()],
        ["HR", "HR team", ...tick("viewAll", "editContracts")],
        ["HR Clerk", "Captures only", ...tick("viewAll", "editContracts")],
        ["Auditor", "Reads and exports", true, false, false, "Yes", false, false],
      ],
      PERMISSION_INFO,
    )!;
    const table: RoleTable = { ...DEFAULT_ROLE_TABLE, contracts: roles };

    expect(roles.map((role) => role.name)).toEqual(["Administrator", "HR", "HR Clerk", "Auditor", "Not allowed"]);
    expect(roles.find((role) => role.name === "Auditor")?.permissions).toEqual(["viewAll", "exportData"]);
    // HR lost "run reports" on the tab, and that is what applies.
    expect(can(accessForRoles("HR", null, table), "runReports")).toBe(false);
    // A new role works as soon as it is on the tab.
    expect(resolveAccess("hr clerk", "", table)).toMatchObject({ ok: true, role: "HR Clerk" });
  });

  it("never lets Administrator lose anything, even if its ticks are cleared or its row deleted", () => {
    const cleared = parseRoleTab([header, ["Administrator", "", ...tick()]], PERMISSION_INFO)!;
    expect(can(accessForRoles("Administrator", null, { ...DEFAULT_ROLE_TABLE, contracts: cleared }), "manageSystem")).toBe(true);

    const deleted = parseRoleTab([header, ["HR", "", ...tick("viewAll")]], PERMISSION_INFO)!;
    expect(deleted[0]).toMatchObject({ name: "Administrator", locked: true });
  });

  it("finds permission columns wherever they are, and ignores columns it does not know", () => {
    const labels = BILLBOARD_PERMISSION_INFO.map((permission) => permission.label);
    const roles = parseRoleTab(
      [
        ["Role", "Notes to self", labels[1], "Description", labels[0]],
        ["Photographer", "ask Tendai", "TRUE", "Adds photos", "TRUE"],
      ],
      BILLBOARD_PERMISSION_INFO,
    )!;
    expect(roles.find((role) => role.name === "Photographer")?.permissions).toEqual([
      "viewBillboards",
      "editBillboards",
    ]);
  });

  it("falls back to the built-in roles when the tab holds nothing usable", () => {
    expect(parseRoleTab(null, PERMISSION_INFO)).toBeNull();
    expect(parseRoleTab([["Something", "else"]], PERMISSION_INFO)).toBeNull();
  });

  it("treats a role that cannot see anything in an app as no access to it", () => {
    const roles = parseRoleTab([header, ["Exporter", "", ...tick("exportData")]], PERMISSION_INFO)!;
    const table: RoleTable = { ...DEFAULT_ROLE_TABLE, contracts: roles };
    expect(resolveAccess("Exporter", "", table)).toMatchObject({ ok: false });
    expect(resolveAccess("Exporter", "Viewer", table)).toMatchObject({ ok: true, role: null, permissions: [] });
  });
});
