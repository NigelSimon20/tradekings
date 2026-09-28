import { BrandWordmark } from "@/components/layout/brand-wordmark";
import { navItemsFor } from "@/components/layout/nav-items";
import { NavLink } from "@/components/layout/nav-link";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { getConfig } from "@/lib/config/env";
import { accessibleProjects, type ProjectId } from "@/lib/domain/projects";
import { getCurrentUser } from "@/lib/services/auth";
import { formatDate, todayIn } from "@/lib/date/dates";

export async function Sidebar({ project }: { project: ProjectId }) {
  const config = getConfig();
  const user = await getCurrentUser();
  const items = navItemsFor(project, user);
  const live =
    project === "billboards"
      ? config.billboards.google !== null
      : config.dataSource === "google-sheets";

  return (
    <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col overflow-hidden bg-brand-950 lg:flex">
      {/* A soft brand-blue glow keeps the navigation from reading as a flat block. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(28rem 18rem at 10% 0%, rgba(34,155,208,.30), transparent 60%), radial-gradient(22rem 16rem at 90% 100%, rgba(34,95,147,.45), transparent 65%)",
        }}
        aria-hidden
      />

      <div className="relative flex h-full flex-col">
        <div className="px-6 pt-7 pb-6">
          <BrandWordmark tone="light" size="lg" />
          <div className="mt-3 -mx-3">
            <ProjectSwitcher current={project} projects={accessibleProjects(user)} />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-6">
          <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-white/35 uppercase">
            Workspace
          </p>
          {items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              description={item.description}
              icon={<item.icon className="size-4" />}
              exact={item.exact}
            />
          ))}
        </nav>

        <div className="m-4 rounded-xl bg-white/6 p-4 text-xs text-white/60 ring-1 ring-white/10">
          <p className="flex items-center gap-2 font-medium text-white/85">
            <span
              className={`size-2 rounded-full ${live ? "bg-emerald-400" : "bg-amber-400"}`}
              aria-hidden
            />
            {live
              ? project === "billboards"
                ? "Billboard sheet connected"
                : "Google Sheet connected"
              : "Sample data"}
          </p>
          <p className="mt-1.5">
            {formatDate(todayIn(config.timezone))} · {config.timezone}
          </p>
        </div>
      </div>
    </aside>
  );
}
