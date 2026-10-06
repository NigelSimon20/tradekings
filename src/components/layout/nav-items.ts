import {
  BillboardIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardIcon,
  PassportIcon,
  UsersIcon,
  ShieldCheckIcon,
  ContractsIcon,
  DashboardIcon,
  MapIcon,
  ReportsIcon,
  SettingsIcon,
} from "@/components/ui/icons";
import {
  can,
  canBillboards,
  canExpats,
  canLicenses,
  type BillboardPermission,
  type ExpatPermission,
  type LicensePermission,
  type Permission,
} from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";
import type { ProjectId } from "@/lib/domain/projects";

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: typeof DashboardIcon;
  exact: boolean;
  /** Hidden from people without this permission; the page checks it too. */
  permission?: Permission;
  billboardPermission?: BillboardPermission;
  licensePermission?: LicensePermission;
  expatPermission?: ExpatPermission;
}

/** The contract tracker's navigation, shared by the sidebar and the mobile drawer. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Contracts at a glance",
    icon: DashboardIcon,
    exact: true,
  },
  {
    href: "/contracts",
    label: "Contracts",
    description: "The full database",
    icon: ContractsIcon,
    exact: false,
  },
  {
    href: "/reports",
    label: "Reports",
    description: "Weekly HR and manager emails",
    icon: ReportsIcon,
    exact: false,
    permission: "runReports",
  },
  {
    href: "/settings",
    label: "Rules & settings",
    description: "Contract rules and wiring",
    icon: SettingsIcon,
    exact: false,
    permission: "viewAll",
  },
];

/** The billboard tracker's navigation. The map is the front door. */
export const BILLBOARD_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/billboards",
    label: "Map",
    description: "Find sites on the map",
    icon: MapIcon,
    exact: true,
  },
  {
    href: "/billboards/dashboard",
    label: "Dashboard",
    description: "The network at a glance",
    icon: DashboardIcon,
    exact: false,
  },
  {
    href: "/billboards/list",
    label: "All billboards",
    description: "Search and filter every site",
    icon: BillboardIcon,
    exact: false,
  },
  {
    href: "/billboards/settings",
    label: "Setup & access",
    description: "Sheet and who can sign in",
    icon: SettingsIcon,
    exact: false,
    billboardPermission: "manageBillboards",
  },
];

/** The license tracker's navigation. The dashboard and map are the front door. */
export const LICENSE_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/licenses",
    label: "Dashboard & map",
    description: "Compliance at a glance",
    icon: MapIcon,
    exact: true,
  },
  {
    href: "/licenses/register",
    label: "License register",
    description: "Search, filter and export",
    icon: ShieldCheckIcon,
    exact: false,
  },
  {
    href: "/licenses/assets",
    label: "Assets & locations",
    description: "Sites, vehicles and equipment",
    icon: BuildingIcon,
    exact: false,
  },
  {
    href: "/licenses/settings",
    label: "Setup & access",
    description: "Sheet, reminders and access",
    icon: SettingsIcon,
    exact: false,
    licensePermission: "manageLicenses",
  },
];

/** The expat tracker's navigation. */
export const EXPAT_NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/expats",
    label: "Dashboard",
    description: "What needs action",
    icon: DashboardIcon,
    exact: true,
  },
  {
    href: "/expats/people",
    label: "Expats",
    description: "Profiles and families",
    icon: UsersIcon,
    exact: false,
  },
  {
    href: "/expats/expiries",
    label: "Master expiry view",
    description: "Every date, every person",
    icon: CalendarIcon,
    exact: false,
  },
  {
    href: "/expats/applications",
    label: "Applications",
    description: "Permits and renewals in progress",
    icon: PassportIcon,
    exact: false,
  },
  {
    href: "/expats/actions",
    label: "Follow-ups",
    description: "Actions and who owns them",
    icon: ClipboardIcon,
    exact: false,
  },
  {
    href: "/expats/settings",
    label: "Setup & access",
    description: "Sheet, reminders and access",
    icon: SettingsIcon,
    exact: false,
    expatPermission: "manageExpats",
  },
];

export const PROJECT_NAV: Record<ProjectId, readonly NavItem[]> = {
  contracts: NAV_ITEMS,
  billboards: BILLBOARD_NAV_ITEMS,
  licenses: LICENSE_NAV_ITEMS,
  expats: EXPAT_NAV_ITEMS,
};

/** The items this person may see in a tracker's navigation. */
export function navItemsFor(project: ProjectId, user: SessionUser | null): NavItem[] {
  return PROJECT_NAV[project].filter((item) => {
    if (!user) return true;
    if (item.permission) return can(user, item.permission);
    if (item.billboardPermission) return canBillboards(user, item.billboardPermission);
    if (item.licensePermission) return canLicenses(user, item.licensePermission);
    if (item.expatPermission) return canExpats(user, item.expatPermission);
    return true;
  });
}

/** Page title shown in the top bar, derived from the current route. */
export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/contracts") return "Contracts";
  if (pathname === "/contracts/new") return "Add contract";
  if (pathname.startsWith("/contracts/")) return "Contract";
  if (pathname.startsWith("/reports")) return "Weekly reports";
  if (pathname.startsWith("/settings")) return "Rules & settings";
  if (pathname === "/billboards") return "Billboard map";
  if (pathname.startsWith("/billboards/dashboard")) return "Billboard dashboard";
  if (pathname.startsWith("/billboards/list")) return "All billboards";
  if (pathname.startsWith("/billboards/new")) return "Add billboard";
  if (pathname.startsWith("/billboards/settings")) return "Billboard setup & access";
  if (pathname.startsWith("/billboards/")) return "Billboard";
  if (pathname === "/licenses") return "License dashboard";
  if (pathname.startsWith("/licenses/register")) return "License register";
  if (pathname === "/licenses/assets") return "Assets & locations";
  if (pathname.startsWith("/licenses/assets/new")) return "Add asset";
  if (pathname.startsWith("/licenses/assets/")) return "Asset";
  if (pathname.startsWith("/licenses/new")) return "Add license";
  if (pathname.startsWith("/licenses/settings")) return "License setup & access";
  if (pathname.startsWith("/licenses/")) return "License";
  if (pathname === "/expats") return "Expat dashboard";
  if (pathname === "/expats/people") return "Expats";
  if (pathname.startsWith("/expats/expiries")) return "Master expiry view";
  if (pathname.startsWith("/expats/actions")) return "Follow-ups";
  if (pathname.startsWith("/expats/applications")) return "Applications";
  if (pathname.startsWith("/expats/new")) return "Add expat";
  if (pathname.startsWith("/expats/settings")) return "Expat setup & access";
  if (/^\/expats\/[^/]+\/summary/.test(pathname)) return "Expat summary";
  if (pathname.startsWith("/expats/")) return "Expat profile";
  return "Contract Tracker";
}
