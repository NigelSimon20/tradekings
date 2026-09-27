import type { SessionUser } from "@/lib/auth/session";

/**
 * The trackers that live behind the one link. Each has its own navigation,
 * its own spreadsheet and its own access level on the Users tab; the switcher
 * under the wordmark moves between them.
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

/** The trackers this person may open, in switcher order. */
export function accessibleProjects(user: SessionUser | null): Project[] {
  if (!user) return [];
  return PROJECT_IDS.filter((id) => (id === "contracts" ? user.role : user.billboardRole)).map(
    (id) => PROJECTS[id],
  );
}
