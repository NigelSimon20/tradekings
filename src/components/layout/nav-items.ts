import {
  ContractsIcon,
  DashboardIcon,
  ReportsIcon,
  SettingsIcon,
} from "@/components/ui/icons";

/** The primary navigation, shared by the sidebar and the mobile drawer. */
export const NAV_ITEMS = [
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
  },
  {
    href: "/settings",
    label: "Rules & settings",
    description: "Contract rules and wiring",
    icon: SettingsIcon,
    exact: false,
  },
] as const;

/** Page title shown in the top bar, derived from the current route. */
export function titleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/contracts") return "Contracts";
  if (pathname === "/contracts/new") return "Add contract";
  if (pathname.startsWith("/contracts/")) return "Contract";
  if (pathname.startsWith("/reports")) return "Weekly reports";
  if (pathname.startsWith("/settings")) return "Rules & settings";
  return "Contract Tracker";
}
