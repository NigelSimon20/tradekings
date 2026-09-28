import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_TABLE, accessForRoles } from "@/lib/auth/roles";
import { accessibleProjects, landingAfterSignIn, canOpenProject, landingFor, projectForPath } from "@/lib/domain/projects";

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

describe("one sign-in for both apps", () => {
  const both = accessForRoles("HR", "Viewer", DEFAULT_ROLE_TABLE);
  const contractsOnly = accessForRoles("HR", "Not allowed", DEFAULT_ROLE_TABLE);
  const billboardsOnly = accessForRoles(null, "Editor", DEFAULT_ROLE_TABLE);

  it("sends someone with one app straight into it", () => {
    expect(landingAfterSignIn(billboardsOnly, "/")).toBe("/billboards");
    expect(landingAfterSignIn(contractsOnly, "/billboards/list")).toBe("/");
  });

  it("takes someone with both apps where they were going, or the Contract Tracker", () => {
    expect(landingAfterSignIn(both, "/billboards/BB-004")).toBe("/billboards/BB-004");
    expect(landingAfterSignIn(both, "/")).toBe("/");
  });

  it("offers the switcher only to people with both apps", () => {
    expect(accessibleProjects(both).map((project) => project.id)).toEqual(["contracts", "billboards"]);
    expect(accessibleProjects(contractsOnly).map((project) => project.id)).toEqual(["contracts"]);
    expect(accessibleProjects(billboardsOnly).map((project) => project.id)).toEqual(["billboards"]);
    expect(accessibleProjects(null)).toEqual([]);
  });
});
