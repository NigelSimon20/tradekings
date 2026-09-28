"use client";

import Link from "next/link";

import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import type { Project, ProjectId } from "@/lib/domain/projects";
import { cn } from "@/lib/ui/cn";
import { useDismissable } from "@/lib/ui/use-dismissable";

/**
 * Moves between the apps behind the one sign-in. Sits under the wordmark and
 * lists only the apps this person may open; with just one, it is the app's
 * name and nothing more, because there is nothing to switch to.
 */
export function ProjectSwitcher({
  current,
  projects,
}: {
  current: ProjectId;
  /** Only the apps this person may open. */
  projects: Project[];
}) {
  const { container, open, toggle } = useDismissable<HTMLDivElement>();
  const active = projects.find((project) => project.id === current) ?? projects[0];
  if (!active) return null;

  const label = (
    <span className="min-w-0 text-left">
      <span className="block truncate text-sm font-medium text-white/90">{active.name}</span>
      <span className="block truncate text-xs text-white/50">{active.description}</span>
    </span>
  );

  if (projects.length < 2) return <div className="px-3 py-2">{label}</div>;

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Switch app — ${active.name} is open`}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1 transition",
          open ? "bg-white/12 ring-white/20" : "ring-white/10 hover:bg-white/8 hover:ring-white/20",
        )}
      >
        {label}
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-white/60 transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute inset-x-0 z-50 mt-2 overflow-hidden rounded-xl bg-white shadow-panel ring-1 ring-slate-200"
        >
          <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Switch app
          </p>
          {projects.map((project) => {
            const selected = project.id === active.id;
            return (
              <Link
                key={project.id}
                href={project.href}
                role="menuitem"
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2.5 transition-colors",
                  selected ? "bg-brand-50" : "hover:bg-slate-50",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{project.name}</span>
                  <span className="block truncate text-xs text-slate-500">{project.description}</span>
                </span>
                {selected ? <CheckIcon className="size-4 shrink-0 text-brand-700" /> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
