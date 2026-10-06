import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_TABLE, accessForRoles } from "@/lib/auth/roles";
import { planUserChange } from "@/lib/auth/user-admin";
import type { SheetUser } from "@/lib/data/sheet-schema";

const editor = (
  role: string | null,
  billboardRole: string | null,
  licenseRole: string | null = null,
  expatRole: string | null = null,
) => ({
  email: "admin@tkzim.co.zw",
  ...accessForRoles(role, billboardRole, DEFAULT_ROLE_TABLE, licenseRole, expatRole),
});
const bothAdmin = editor("Administrator", "Administrator", "Administrator", "Administrator");
const licensesAdmin = editor(null, null, "Administrator");
const contractsAdmin = editor("Administrator", "Viewer");
const billboardsAdmin = editor("HR", "Administrator");

const rutendo: SheetUser = {
  email: "rutendo@tkzim.co.zw",
  name: "Rutendo",
  role: "HR",
  billboards: "",
  licenses: "",
  expats: "",
  active: true,
  lastSignedIn: "",
  rowNumber: 3,
};
const plan = (who: ReturnType<typeof editor>, existing: SheetUser | undefined, request: Parameters<typeof planUserChange>[2]) =>
  planUserChange(who, existing, request, DEFAULT_ROLE_TABLE);

describe("changing who may sign in from the app", () => {
  it("lets each app's administrators change that app's column only", () => {
    expect(plan(contractsAdmin, rutendo, { email: rutendo.email, role: "Manager" })).toMatchObject({
      ok: true,
      change: { role: "Manager" },
    });
    expect(plan(contractsAdmin, rutendo, { email: rutendo.email, billboards: "Editor" })).toMatchObject({ ok: false });
    expect(plan(billboardsAdmin, rutendo, { email: rutendo.email, billboards: "editor" })).toMatchObject({
      ok: true,
      change: { billboards: "Editor" },
    });
    expect(plan(billboardsAdmin, rutendo, { email: rutendo.email, role: "Administrator" })).toMatchObject({ ok: false });
  });

  it("writes only what changed", () => {
    const result = plan(contractsAdmin, rutendo, { email: rutendo.email, role: "HR", billboards: "" });
    expect(result).toEqual({ ok: true, created: false, change: { email: rutendo.email } });
  });

  it("lets License Tracker administrators change the Licenses column only", () => {
    expect(plan(licensesAdmin, rutendo, { email: rutendo.email, licenses: "Viewer" })).toMatchObject({
      ok: true,
      change: { licenses: "Viewer" },
    });
    expect(plan(licensesAdmin, rutendo, { email: rutendo.email, role: "Manager" })).toMatchObject({ ok: false });
  });

  it("keeps switching someone off to administrators of every app", () => {
    expect(plan(contractsAdmin, rutendo, { email: rutendo.email, active: false })).toMatchObject({ ok: false });
    expect(plan(bothAdmin, rutendo, { email: rutendo.email, active: false })).toMatchObject({
      ok: true,
      change: { active: false },
    });
  });

  it("never lets an administrator change their own access", () => {
    expect(plan(bothAdmin, undefined, { email: "ADMIN@tkzim.co.zw", role: "Not allowed" })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/own access/),
    });
  });

  it("refuses people who are not administrators, and roles that do not exist", () => {
    expect(plan(editor("HR", "Editor"), rutendo, { email: rutendo.email, role: "Manager" })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/Only an administrator/),
    });
    expect(plan(bothAdmin, rutendo, { email: rutendo.email, role: "Supervisor" })).toMatchObject({ ok: false });
  });

  it("adds a new person with a role in at least one app", () => {
    expect(
      plan(billboardsAdmin, undefined, { email: "Tendai@TKZim.co.zw", name: "Tendai", billboards: "Viewer" }),
    ).toEqual({
      ok: true,
      created: true,
      change: { email: "tendai@tkzim.co.zw", name: "Tendai", billboards: "Viewer" },
    });
    expect(plan(bothAdmin, undefined, { email: "x@tkzim.co.zw", role: "Not allowed", billboards: "" })).toMatchObject({
      ok: false,
    });
    expect(plan(bothAdmin, undefined, { email: "not-an-email", role: "HR" })).toMatchObject({ ok: false });
  });
});
