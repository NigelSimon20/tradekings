"use client";

import Link from "next/link";

import { BellIcon, CheckIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { AlertsSummary } from "@/lib/services/alerts";
import { useDismissable } from "@/lib/ui/use-dismissable";
import { useStoredValue } from "@/lib/ui/use-stored-value";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

const SEEN_KEY = "tkzim.alerts.seen";

/**
 * The notification bell.
 *
 * The count is live data — contracts that need a decision plus rows that need
 * fixing in the sheet. "Seen" is remembered per browser so the red dot only
 * returns when the underlying alerts actually change.
 */
export function AlertsMenu({ alerts }: { alerts: AlertsSummary }) {
  const { container, open, toggle } = useDismissable<HTMLDivElement>();
  const [seen, setSeen] = useStoredValue(SEEN_KEY);

  const unseen = alerts.total > 0 && seen !== alerts.signature;

  const markSeen = () => setSeen(alerts.signature);

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Alerts — ${alerts.total} item${alerts.total === 1 ? "" : "s"} need attention`}
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-xl text-slate-600 transition",
          "hover:bg-slate-100 hover:text-slate-900",
          open && "bg-slate-100 text-slate-900",
        )}
      >
        <BellIcon className="size-5" />
        {alerts.total > 0 ? (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums",
              unseen ? "bg-red-600" : "bg-slate-400",
            )}
          >
            {alerts.total > 99 ? "99+" : alerts.total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Alerts"
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-white shadow-panel ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-display text-sm font-semibold text-slate-900">Alerts</p>
              <p className="text-xs text-slate-500">
                {alerts.total === 0
                  ? "Nothing needs attention"
                  : `${alerts.total} item${alerts.total === 1 ? "" : "s"} across the database`}
              </p>
            </div>
            {alerts.total > 0 ? (
              <button
                type="button"
                onClick={markSeen}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <CheckIcon className="size-3.5" />
                Mark seen
              </button>
            ) : null}
          </div>

          {alerts.groups.length ? (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto scroll-slim">
              {alerts.groups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={group.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50"
                  >
                    <span className={cn("size-2 shrink-0 rounded-full", TONE_CLASSES[group.tone].dot)} />
                    <span className="flex-1 text-sm text-slate-700">{group.label}</span>
                    <span className="numeric text-sm font-semibold text-slate-900">{group.count}</span>
                    <ChevronRightIcon className="size-4 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Every contract is active and up to date.
            </p>
          )}

          {alerts.urgent.length ? (
            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Most urgent
              </p>
              <ul className="mt-2 space-y-1.5">
                {alerts.urgent.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white"
                    >
                      <span className="truncate font-medium text-slate-800">{item.name}</span>
                      <span className={cn("shrink-0 text-xs", TONE_CLASSES[item.tone].text)}>
                        {item.detail}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Link
            href="/contracts?view=renewals-due"
            className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            Open everything needing attention
          </Link>
        </div>
      ) : null}
    </div>
  );
}
