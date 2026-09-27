import { describe, expect, it } from "vitest";

import { can, canBillboards, resolveAccess } from "@/lib/auth/roles";

describe("access from the Users tab", () => {
  it("gives contracts and billboards independently", () => {
    expect(resolveAccess("HR", "")).toEqual({ ok: true, role: "HR", billboardRole: null });
    expect(resolveAccess("", "Editor")).toEqual({ ok: true, role: null, billboardRole: "Editor" });
    expect(resolveAccess("Administrator", "Viewer")).toEqual({
      ok: true,
      role: "Administrator",
      billboardRole: "Viewer",
    });
  });

  it("reads the levels however they were typed", () => {
    expect(resolveAccess("", "standard user")).toMatchObject({ billboardRole: "Editor" });
    expect(resolveAccess("", " view only ")).toMatchObject({ billboardRole: "Viewer" });
    expect(resolveAccess("", "ADMIN")).toMatchObject({ billboardRole: "Administrator" });
  });

  it("refuses a row with no access to either tracker", () => {
    expect(resolveAccess("", "")).toMatchObject({ ok: false });
  });

  it("refuses a typo rather than guessing", () => {
    expect(resolveAccess("Supervisor", "")).toMatchObject({ ok: false });
    expect(resolveAccess("HR", "Owner")).toMatchObject({ ok: false });
  });
});

describe("permissions", () => {
  it("gives a billboard-only person nothing on the contract side", () => {
    expect(can(null, "viewAll")).toBe(false);
    expect(can(null, "viewOwn")).toBe(false);
  });

  it("keeps archiving and removing documents for billboard administrators", () => {
    expect(canBillboards("Administrator", "manageBillboards")).toBe(true);
    expect(canBillboards("Editor", "manageBillboards")).toBe(false);
    expect(canBillboards("Editor", "editBillboards")).toBe(true);
    expect(canBillboards("Viewer", "editBillboards")).toBe(false);
    expect(canBillboards("Viewer", "viewBillboards")).toBe(true);
    expect(canBillboards(null, "viewBillboards")).toBe(false);
  });
});
