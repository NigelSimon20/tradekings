import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_TABLE, accessForRoles } from "@/lib/auth/roles";
import { canOpenProject, landingFor, projectForPath } from "@/lib/domain/projects";

describe("choosing a tracker at sign-in", () => {
  it("knows which tracker a page belongs to", () => {
    expect(projectForPath("/")).toBe("contracts");
    expect(projectForPath("/contracts/TK-1")).toBe("contracts");
    expect(projectForPath("/billboards")).toBe("billboards");
    expect(projectForPath("/billboards/BB-001")).toBe("billboards");
    expect(projectForPath("/billboardsX")).toBe("contracts");
  });

  it("returns to the page asked for only when it is in the chosen tracker", () => {
    expect(landingFor("billboards", "/billboards/BB-004")).toBe("/billboards/BB-004");
    expect(landingFor("billboards", "/contracts")).toBe("/billboards");
    expect(landingFor("contracts", "/billboards/list")).toBe("/");
    expect(landingFor("contracts", "/contracts?view=expired")).toBe("/contracts?view=expired");
  });

  it("never sends someone off-site", () => {
    expect(landingFor("contracts", "https://evil.example")).toBe("/");
    expect(landingFor("contracts", "//evil.example")).toBe("/");
  });

  it("checks access per tracker", () => {
    expect(canOpenProject(accessForRoles("HR", null, DEFAULT_ROLE_TABLE), "billboards")).toBe(false);
    expect(canOpenProject(accessForRoles(null, "Viewer", DEFAULT_ROLE_TABLE), "billboards")).toBe(true);
    expect(canOpenProject(accessForRoles(null, "Viewer", DEFAULT_ROLE_TABLE), "contracts")).toBe(false);
    expect(canOpenProject(accessForRoles("Manager", null, DEFAULT_ROLE_TABLE), "contracts")).toBe(true);
  });
});
