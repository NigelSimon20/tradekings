import Link from "next/link";

import { ChevronRightIcon } from "@/components/ui/icons";

/**
 * The band at the top of the dashboard: the three numbers a person needs
 * before anything else, on the brand blues.
 */
export function SummaryBanner({
  employees,
  active,
  needsAction,
  nextReport,
}: {
  employees: number;
  active: number;
  needsAction: number;
  nextReport: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-900 text-white shadow-card">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(32rem 20rem at 85% -20%, rgba(34,155,208,.55), transparent 62%), radial-gradient(24rem 16rem at 0% 120%, rgba(34,155,208,.25), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5 px-5 py-5 sm:gap-x-10 sm:px-6 sm:py-6">
        <Figure label="Employees tracked" value={employees} />
        <Figure label="Contracts active today" value={active} />
        <Figure
          label="Requiring attention"
          value={needsAction}
          tone={needsAction > 0 ? "text-amber-300" : "text-emerald-300"}
        />

        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:items-end">
          <p className="text-xs text-white/70">Next weekly report · {nextReport}</p>
          <Link
            href="/contracts?view=renewals-due"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/20 transition hover:bg-white/20"
          >
            Review what needs action
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-white/60 uppercase">{label}</p>
      <p className={`numeric font-display mt-1 text-3xl font-semibold sm:text-4xl ${tone ?? "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
