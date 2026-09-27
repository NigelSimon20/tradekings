"use client";

import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { ChevronRightIcon, SettingsIcon, SignOutIcon } from "@/components/ui/icons";
import {
  describeBillboardRole,
  describeRole,
  type BillboardRole,
  type Role,
} from "@/lib/auth/roles";
import { cn, initialsOf } from "@/lib/ui/cn";
import { useDismissable } from "@/lib/ui/use-dismissable";

export interface MenuUser {
  name: string;
  email: string;
  role: Role | null;
  billboardRole: BillboardRole | null;
}

/**
 * The account menu: who you are signed in as, and how to sign out.
 *
 * Sign-out used to be an unlabelled icon, which people did not find. It is now
 * a named item in a menu opened from your own name.
 */
export function UserMenu({ user, signInEnabled }: { user: MenuUser; signInEnabled: boolean }) {
  const { container, open, toggle } = useDismissable<HTMLDivElement>();
  // One line per tracker the person can open, so someone with both sees both.
  const access = [
    user.role ? { tracker: "Contracts", level: user.role, detail: describeRole(user.role) } : null,
    user.billboardRole
      ? {
          tracker: "Billboards",
          level: user.billboardRole,
          detail: describeBillboardRole(user.billboardRole),
        }
      : null,
  ].filter((entry) => entry !== null);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2 rounded-xl py-1 pr-2 pl-2 ring-1 transition",
          open ? "bg-slate-100 ring-slate-300" : "ring-slate-200 hover:bg-slate-50",
        )}
      >
        <span className="hidden text-left text-xs leading-tight sm:block">
          <span className="block max-w-40 truncate font-medium text-slate-800">{user.name}</span>
          <span className="block text-slate-500">
            {access.length === 2 && access[0].level !== access[1].level
              ? access.map((entry) => `${entry.tracker} ${entry.level}`).join(" · ")
              : access[0]?.level}
          </span>
        </span>
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-700 text-xs font-semibold text-white">
          {initialsOf(user.name)}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="font-display text-sm font-semibold text-slate-900">{user.name}</p>
            {user.email ? (
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            ) : null}
            {access.map((entry) => (
              <p key={entry.tracker} className="mt-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {entry.tracker}: {entry.level}
                </span>{" "}
                — {entry.detail}
              </p>
            ))}
          </div>

          {signInEnabled ? (
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-800"
              >
                <SignOutIcon className="size-4" />
                Sign out
              </button>
            </form>
          ) : (
            <div className="px-4 py-3">
              <p className="text-xs text-slate-500">
                Signing in is not set up yet, so there is nobody to sign out — anyone with the link
                can open the tracker.
              </p>
              <Link
                href="/settings"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
              >
                <SettingsIcon className="size-3.5" />
                How to turn sign-in on
                <ChevronRightIcon className="size-3.5" />
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
