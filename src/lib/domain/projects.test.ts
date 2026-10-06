import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_TABLE, accessForRoles, canExpats, resolveAccess } from "@/lib/auth/roles";
import { accessibleProjects, homeFor, landingAfterSignIn, canOpenProject, landingFor, projectForPath } from "@/lib/domain/projects";

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

describe("the License Tracker", () => {
  const licensesOnly = accessForRoles(null, null, DEFAULT_ROLE_TABLE, "Viewer");

  it("is its own app with its own pages", () => {
    expect(projectForPath("/licenses")).toBe("licenses");
    expect(projectForPath("/licenses/assets/A-1")).toBe("licenses");
    expect(projectForPath("/licensesX")).toBe("contracts");
  });

  it("sends a license-only person to it, never to sign-in", () => {
    expect(landingAfterSignIn(licensesOnly, "/")).toBe("/licenses");
    expect(homeFor(licensesOnly, "contracts")).toBe("/licenses");
    expect(homeFor(licensesOnly, "billboards", { denied: true })).toBe("/licenses?denied=1");
    expect(accessibleProjects(licensesOnly).map((project) => project.id)).toEqual(["licenses"]);
  });
});

describe("the Expat Tracker", () => {
  const expatsOnly = accessForRoles(null, null, DEFAULT_ROLE_TABLE, null, "Read only");

  it("is its own app, listed last in the switcher", () => {
    expect(projectForPath("/expats/EXP-001/summary")).toBe("expats");
    expect(projectForPath("/expatsX")).toBe("contracts");
    const everything = accessForRoles("Administrator", "Administrator", DEFAULT_ROLE_TABLE, "Administrator", "Administrator");
    expect(accessibleProjects(everything).map((project) => project.id)).toEqual(["contracts", "billboards", "licenses", "expats"]);
  });

  it("lets an expat-only person in, and lands them there", () => {
    expect(resolveAccess("", "", DEFAULT_ROLE_TABLE, "", "Read only").ok).toBe(true);
    expect(landingAfterSignIn(expatsOnly, "/")).toBe("/expats");
    expect(canOpenProject(expatsOnly, "licenses")).toBe(false);
  });

  it("keeps sensitive details to roles that are given them", () => {
    expect(canExpats(expatsOnly, "viewSensitive")).toBe(false);
    const standard = accessForRoles(null, null, DEFAULT_ROLE_TABLE, null, "standard");
    expect(standard.expatRole).toBe("Standard user");
    expect(canExpats(standard, "viewSensitive")).toBe(true);
    expect(canExpats(standard, "manageExpats")).toBe(false);
  });

  it("refuses a role that is not on the Expat Roles tab", () => {
    const decision = resolveAccess("", "", DEFAULT_ROLE_TABLE, "", "Supervisor");
    expect(decision.ok).toBe(false);
  });
});
