import { describe, expect, it } from "vitest";

import { refreshSessionAccess } from "@/lib/auth/access";
import { DEFAULT_ROLE_TABLE, PERMISSION_INFO, accessForRoles, can, parseRoleTab } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { SheetUser } from "@/lib/data/sheet-schema";

const SESSION: SessionUser = {
  email: "rutendo@tkzim.co.zw",
  name: "Rutendo",
  via: "google",
  ...accessForRoles("HR", "Editor", DEFAULT_ROLE_TABLE),
};

const row = (overrides: Partial<SheetUser> = {}): SheetUser => ({
  email: "rutendo@tkzim.co.zw",
  name: "Rutendo Moyo",
  role: "HR",
  billboards: "Editor",
  licenses: "",
  active: true,
  lastSignedIn: "",
  rowNumber: 2,
  ...overrides,
});

const refresh = (users: SheetUser[] | null, admins: string[] = [], roles = DEFAULT_ROLE_TABLE) =>
  refreshSessionAccess(SESSION, users ? { users, roles } : null, admins, DEFAULT_ROLE_TABLE);

describe("access for someone already signed in", () => {
  it("follows the sheet as it is now, not as it was at sign-in", () => {
    expect(refresh([row({ billboards: "" })])).toMatchObject({ role: "HR", billboardRole: null, billboardPermissions: [] });
    expect(refresh([row({ role: "Manager" })])?.permissions).toEqual(["viewOwn"]);
    expect(refresh([row()])?.name).toBe("Rutendo Moyo");
  });

  it("follows a permission unticked on the roles tab", () => {
    const header = ["Role", "Description", ...PERMISSION_INFO.map((permission) => permission.label)];
    const contracts = parseRoleTab(
      [header, ["HR", "", ...PERMISSION_INFO.map((permission) => permission.key === "viewAll")]],
      PERMISSION_INFO,
    )!;
    const user = refresh([row()], [], { ...DEFAULT_ROLE_TABLE, contracts });
    expect(can(user, "viewAll")).toBe(true);
    expect(can(user, "editContracts")).toBe(false);
  });

  it("signs out someone removed, switched off or left with no access", () => {
    expect(refresh([])).toBeNull();
    expect(refresh([row({ active: false })])).toBeNull();
    expect(refresh([row({ role: "", billboards: "" })])).toBeNull();
    expect(refresh([row({ role: "Supervisor" })])).toBeNull();
  });

  it("keeps the session when the lists cannot be read, so an outage signs nobody out", () => {
    const kept = refresh(null);
    expect(kept).toMatchObject({ role: "HR", billboardRole: "Editor" });
    expect(can(kept, "editContracts")).toBe(true);
  });

  it("lets an ADMIN_EMAILS address follow its own row, so roles can be tried with it", () => {
    const own = refresh([row({ role: "Administrator", billboards: "Viewer" })], ["rutendo@tkzim.co.zw"]);
    expect(own).toMatchObject({ role: "Administrator", billboardRole: "Viewer", billboardPermissions: ["viewBillboards"] });
  });

  it("never locks an ADMIN_EMAILS address out", () => {
    const admins = ["rutendo@tkzim.co.zw"];
    for (const rows of [[], [row({ active: false })], [row({ role: "Not allowed", billboards: "Not allowed" })], [row({ role: "Typo" })]]) {
      const admin = refresh(rows, admins);
      expect(admin).toMatchObject({ role: "Administrator", billboardRole: "Administrator" });
      expect(can(admin, "manageSystem")).toBe(true);
    }
    expect(refresh(null, admins)).toMatchObject({ role: "Administrator", billboardRole: "Administrator" });
  });

  it("gives shared-password sessions the roles they were issued with", () => {
    const password: SessionUser = { ...SESSION, email: "", via: "password", ...accessForRoles("Administrator", "Administrator", DEFAULT_ROLE_TABLE) };
    expect(refreshSessionAccess(password, { users: [], roles: DEFAULT_ROLE_TABLE }, [], DEFAULT_ROLE_TABLE)).toMatchObject({
      role: "Administrator",
    });
  });
});
