import { signOutAction } from "@/app/login/actions";
import { AlertsMenu } from "@/components/layout/alerts-menu";
import { BrandWordmark } from "@/components/layout/brand-wordmark";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTitle } from "@/components/layout/page-title";
import { ButtonLink } from "@/components/ui/button";
import { PlusIcon, SignOutIcon } from "@/components/ui/icons";
import { getConfig } from "@/lib/config/env";
import { formatDate, todayIn } from "@/lib/date/dates";
import { loadAlerts } from "@/lib/services/alerts";

/** Sticky application header: context on the left, alerts and actions on the right. */
export async function Topbar() {
  const config = getConfig();
  const alerts = await loadAlerts();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-3 px-4 lg:px-8">
        <MobileNav />
        <BrandWordmark size="sm" className="lg:hidden" />

        <div className="hidden items-center gap-2 lg:flex">
          <PageTitle />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            {formatDate(todayIn(config.timezone))}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/contracts/new" size="sm" className="hidden sm:inline-flex">
            <PlusIcon className="size-4" />
            New contract
          </ButtonLink>

          <AlertsMenu alerts={alerts} />

          <div className="flex items-center gap-2 rounded-xl py-1 pr-1 pl-2 ring-1 ring-slate-200">
            <span className="hidden text-xs leading-tight sm:block">
              <span className="block font-medium text-slate-800">HR / Admin</span>
              <span className="block text-slate-500">Trade Kings · Zimkings</span>
            </span>
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-700 text-xs font-semibold text-white">
              HR
            </span>
            {config.auth.enabled ? (
              <form action={signOutAction}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <SignOutIcon className="size-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
