import { can, canBillboards } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";

/**
 * The trackers that live behind the one link. Each has its own navigation,
 * its own spreadsheet and its own access level on the Users tab. People pick
 * one on the sign-in page.
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

/**
 * Where to land after signing in to a tracker: the page that was asked for if
 * it belongs to that tracker, otherwise the tracker's front page.
 */
export function landingFor(project: ProjectId, requested: string | null | undefined): string {
  const next = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "";
  return next && projectForPath(next) === project ? next : PROJECTS[project].href;
}
