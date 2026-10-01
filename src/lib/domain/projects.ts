import { can, canBillboards, canLicenses } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";

/**
 * The trackers that live behind the one link. Each has its own navigation,
 * its own spreadsheet and its own access level on the Users tab. There is one
 * sign-in; access decides which apps someone gets, and the switcher under the
 * wordmark moves between them when they have more than one.
 */
export const PROJECT_IDS = ["contracts", "billboards", "licenses"] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  /** Where the switcher takes you. */
  href: string;
}

export const PROJECTS: Record<ProjectId, Project> = {
  contracts: {
    id: "contracts",
    name: "Contract Tracker",
    description: "Blue collar & casual employees",
    href: "/",
  },
  billboards: {
    id: "billboards",
    name: "Billboard Tracker",
    description: "Sites, leases & campaigns",
    href: "/billboards",
  },
  licenses: {
    id: "licenses",
    name: "License Tracker",
    description: "Licenses, permits & compliance",
    href: "/licenses",
  },
};

export function isProjectId(value: unknown): value is ProjectId {
  return typeof value === "string" && (PROJECT_IDS as readonly string[]).includes(value);
}

/** Which tracker a page belongs to. */
export function projectForPath(path: string): ProjectId {
  const under = (root: string) => path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}?`);
  if (under("/billboards")) return "billboards";
  if (under("/licenses")) return "licenses";
  return "contracts";
}

/** Opening an app needs a role there that is allowed to see something in it. */
export function canOpenProject(
  user: Pick<SessionUser, "permissions" | "billboardPermissions" | "licensePermissions">,
  project: ProjectId,
): boolean {
  switch (project) {
    case "contracts":
      return can(user, "viewAll") || can(user, "viewOwn");
    case "billboards":
      return canBillboards(user, "viewBillboards");
    case "licenses":
      return canLicenses(user, "viewLicenses");
  }
}

/** The apps this person can open, in switcher order. */
export function accessibleProjects(
  user: Pick<SessionUser, "permissions" | "billboardPermissions" | "licensePermissions"> | null,
): Project[] {
  if (!user) return [];
  return PROJECT_IDS.filter((id) => canOpenProject(user, id)).map((id) => PROJECTS[id]);
}

/**
 * After signing in: the page that was asked for if this person can open its
 * app, otherwise the front page of the first app they can open.
 */
export function landingAfterSignIn(
  user: Pick<SessionUser, "permissions" | "billboardPermissions" | "licensePermissions">,
  requested: string,
): string {
  const wanted = projectForPath(requested);
  if (canOpenProject(user, wanted)) return landingFor(wanted, requested);
  const open = PROJECT_IDS.find((id) => canOpenProject(user, id));
  return open ? PROJECTS[open].href : "/";
}

/**
 * Where to land in a given tracker: the page that was asked for if
 * it belongs to that tracker, otherwise the tracker's front page.
 */
export function landingFor(project: ProjectId, requested: string | null | undefined): string {
  const next = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "";
  return next && projectForPath(next) === project ? next : PROJECTS[project].href;
}

/**
 * Where to send someone who cannot open the app they asked for: the first app
 * they can open (with `?denied=1` so it can say why), or sign-in if none.
 */
export function homeFor(
  user: Pick<SessionUser, "permissions" | "billboardPermissions" | "licensePermissions">,
  avoiding: ProjectId,
  { denied = false }: { denied?: boolean } = {},
): string {
  const open = PROJECT_IDS.find((id) => id !== avoiding && canOpenProject(user, id));
  if (!open) return "/login";
  return denied ? `${PROJECTS[open].href}?denied=1` : PROJECTS[open].href;
}
