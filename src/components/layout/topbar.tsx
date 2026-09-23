import { AlertsMenu } from "@/components/layout/alerts-menu";
import { BrandWordmark } from "@/components/layout/brand-wordmark";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTitle } from "@/components/layout/page-title";
import { UserMenu } from "@/components/layout/user-menu";
import { ButtonLink } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { getConfig } from "@/lib/config/env";
import { formatDate, todayIn } from "@/lib/date/dates";
import { can } from "@/lib/auth/roles";
import { loadAlerts } from "@/lib/services/alerts";
import { getCurrentUser } from "@/lib/services/auth";

/** Sticky application header: context on the left, alerts and actions on the right. */
export async function Topbar() {
  const config = getConfig();
  const [alerts, user] = await Promise.all([loadAlerts(), getCurrentUser()]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-8">
        <MobileNav signInEnabled={config.auth.enabled} />
        <BrandWordmark size="sm" className="truncate lg:hidden" />

        <div className="hidden items-center gap-2 lg:flex">
          <PageTitle />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            {formatDate(todayIn(config.timezone))}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Shown only alongside the desktop navigation: on a phone the top
              bar is for context and alerts, and the contracts page carries its
              own "Add contract" button. */}
          {user && can(user.role, "editContracts") ? (
            <ButtonLink href="/contracts/new" size="sm" className="hidden lg:inline-flex">
              <PlusIcon className="size-4" />
              New contract
            </ButtonLink>
          ) : null}

          <AlertsMenu alerts={alerts} />

          {user ? (
            <UserMenu
              user={{ name: user.name, email: user.email, role: user.role }}
              signInEnabled={config.auth.enabled}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
