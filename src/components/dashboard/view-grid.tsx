import { StatCard } from "@/components/ui/stat-card";
import { AlertIcon, ContractsIcon, RefreshIcon, SettingsIcon } from "@/components/ui/icons";
import { CONTRACT_VIEWS, countView, rowsForView, type ContractView } from "@/lib/domain/views";
import type { EvaluatedContract } from "@/lib/domain/types";

const GROUPS: Record<
  ContractView["group"],
  { title: string; caption: string; icon: typeof ContractsIcon }
> = {
  contracts: {
    title: "Contract status",
    caption: "Where every current contract stands today",
    icon: ContractsIcon,
  },
  limits: {
    title: "Contract limits",
    caption: "Zimkings 5-contract rule and the casual 6-contract rule",
    icon: AlertIcon,
  },
  rehire: {
    title: "Casual rehire eligibility",
    caption: "The 3-month break after six weekly contracts",
    icon: RefreshIcon,
  },
  data: {
    title: "Data quality",
    caption: "Rows that need fixing in the Google Sheet",
    icon: SettingsIcon,
  },
};

/**
 * The dashboard summary. Each tile is a saved view, so clicking through always
 * lands on exactly the rows that were counted.
 */
export function ViewGrid({
  latest,
  all,
  groups,
}: {
  /** Current contract per employee. */
  latest: EvaluatedContract[];
  /** Every row, including superseded history. */
  all: EvaluatedContract[];
  groups: ContractView["group"][];
}) {
  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const views = CONTRACT_VIEWS.filter((view) => view.group === group);
        if (!views.length) return null;

        const meta = GROUPS[group];
        const Icon = meta.icon;

        return (
          <section key={group}>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-white text-brand-700 shadow-xs ring-1 ring-slate-200/70">
                <Icon className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">{meta.title}</h2>
                <p className="text-xs text-slate-500">{meta.caption}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {views.map((view) => {
                const rows = rowsForView(view, { latest, all });
                return (
                  <StatCard
                    key={view.id}
                    label={view.label}
                    value={countView(rows, view)}
                    total={rows.length}
                    description={view.description}
                    tone={view.tone}
                    href={`/contracts?view=${view.id}`}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
