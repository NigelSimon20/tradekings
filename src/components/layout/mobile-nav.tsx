"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/login/actions";
import { PROJECT_NAV } from "@/components/layout/nav-items";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { CloseIcon, MenuIcon, SignOutIcon } from "@/components/ui/icons";
import { Portal } from "@/components/ui/portal";
import type { Project, ProjectId } from "@/lib/domain/projects";
import { useDismissable } from "@/lib/ui/use-dismissable";
import { cn } from "@/lib/ui/cn";

/**
 * Slide-over navigation for phones and tablets. The server decides which items
 * this person may see (`hrefs`), the same way the desktop sidebar does.
 */
export function MobileNav({
  project,
  projects,
  hrefs,
  signInEnabled = false,
}: {
  project: ProjectId;
  projects: Project[];
  hrefs: string[];
  signInEnabled?: boolean;
}) {
  const items = PROJECT_NAV[project].filter((item) => hrefs.includes(item.href));
  const pathname = usePathname();
  const { open, show, close } = useDismissable<HTMLElement>();

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label="Open navigation"
        className="inline-flex size-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
      >
        <MenuIcon className="size-5" />
      </button>

      {open ? (
        <Portal>
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm"
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-950 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-white">Trade Kings · Zimkings</p>
              <button
                type="button"
                onClick={close}
                aria-label="Close navigation"
                className="inline-flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="mt-4">
              <ProjectSwitcher current={project} projects={projects} />
            </div>

            <ul className="mt-4 space-y-1">
              {items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {signInEnabled ? (
              <form action={signOutAction} className="mt-auto pt-4">
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <SignOutIcon className="size-4" />
                  Sign out
                </button>
              </form>
            ) : null}
          </nav>
        </div>
        </Portal>
      ) : null}
    </>
  );
}
