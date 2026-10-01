import Link from "next/link";

import { MapIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/ui/cn";

/** Switches between the dashboard & map and the license register, as the brief asks. */
export function ViewSwitch({ current }: { current: "map" | "register" }) {
  const item = (key: "map" | "register", href: string, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
        current === key ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {icon}
      {label}
    </Link>
  );
  return (
    <nav aria-label="View" className="inline-flex rounded-xl bg-slate-100 p-1">
      {item("map", "/licenses", "Map view", <MapIcon className="size-4" />)}
      {item("register", "/licenses/register", "Register", <ShieldCheckIcon className="size-4" />)}
    </nav>
  );
}
