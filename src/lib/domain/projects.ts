import { can, canBillboards } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";

/**
 * The trackers that live behind the one link. Each has its own navigation,
 * its own spreadsheet and its own access level on the Users tab. There is one
 * sign-in; access decides which apps someone gets, and the switcher under the
 * wordmark moves between them when they have more than one.
 */
export const PROJECT_IDS = ["contracts", "billboards"] as const;
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
};

export function isProjectId(value: unknown): value is ProjectId {
  return typeof value === "string" && (PROJECT_IDS as readonly string[]).includes(value);
}

/** Which tracker a page belongs to. */
export function projectForPath(path: string): ProjectId {
  return path === "/billboards" || path.startsWith("/billboards/") || path.startsWith("/billboards?")
    ? "billboards"
    : "contracts";
}

/** Opening an app needs a role there that is allowed to see something in it. */
export function canOpenProject(
  user: Pick<SessionUser, "permissions" | "billboardPermissions">,
  project: ProjectId,
): boolean {
  return project === "contracts"
    ? can(user, "viewAll") || can(user, "viewOwn")
    : canBillboards(user, "viewBillboards");
}

/** The apps this person can open, in switcher order. */
export function accessibleProjects(
  user: Pick<SessionUser, "permissions" | "billboardPermissions"> | null,
): Project[] {
  if (!user) return [];
  return PROJECT_IDS.filter((id) => canOpenProject(user, id)).map((id) => PROJECTS[id]);
}

/**
 * After signing in: the page that was asked for if this person can open its
 * app, otherwise the front page of the first app they can open.
 */
export function landingAfterSignIn(
  user: Pick<SessionUser, "permissions" | "billboardPermissions">,
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
