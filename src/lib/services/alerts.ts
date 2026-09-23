import "server-only";

import type { Tone } from "@/lib/domain/meta";
import { countDataIssues } from "@/lib/domain/views";
import type { EvaluatedContract } from "@/lib/domain/types";
import { describeDays } from "@/lib/date/dates";
import { sortByUrgency } from "@/lib/domain/filters";
import { loadSnapshot } from "@/lib/services/contracts";

export interface AlertGroup {
  id: string;
  label: string;
  count: number;
  tone: Tone;
  href: string;
}

export interface AlertItem {
  id: string;
  name: string;
  detail: string;
  tone: Tone;
  href: string;
}

export interface AlertsSummary {
  /** Number shown on the bell. */
  total: number;
  groups: AlertGroup[];
  /** The few contracts a person should look at first. */
  urgent: AlertItem[];
  /** Changes whenever the alert set changes — used to mark alerts as seen. */
  signature: string;
}

/**
 * Feeds the notification bell. It reads the same request-cached snapshot the
 * page itself uses, so showing alerts costs no extra call to the sheet.
 */
export async function loadAlerts(): Promise<AlertsSummary> {
  const { latest, contracts } = await loadSnapshot();

  const count = (predicate: (contract: EvaluatedContract) => boolean) =>
    latest.reduce((total, contract) => (predicate(contract) ? total + 1 : total), 0);

  const dataIssues = countDataIssues(contracts);

  const groups: AlertGroup[] = ([
    {
      id: "expired",
      label: "Expired or overdue",
      count: count((c) => c.computed.status === "EXPIRED" || c.computed.status === "OVERDUE"),
      tone: "critical",
      href: "/contracts?view=expired",
    },
    {
      id: "today",
      label: "Expiring today",
      count: count((c) => c.computed.status === "EXPIRES_TODAY"),
      tone: "danger",
      href: "/contracts?view=expires-today",
    },
    {
      id: "expiring-15",
      label: "Expiring within 15 days",
      count: count((c) => c.computed.status === "EXPIRING_15"),
      tone: "warning",
      href: "/contracts?view=expiring-15",
    },
    {
      id: "expiring-30",
      label: "Expiring within 30 days",
      count: count((c) => c.computed.status === "EXPIRING_30"),
      tone: "caution",
      href: "/contracts?view=expiring-30",
    },
    {
      id: "limits",
      label: "At the contract limit",
      count: count((c) =>
        c.computed.flags.some(
          (flag) => flag.code === "ZIM_LIMIT_REACHED" || flag.code === "CASUAL_LIMIT_REACHED",
        ),
      ),
      tone: "critical",
      href: "/contracts?view=zim-reached",
    },
    {
      id: "rehire",
      label: "Casuals eligible for rehire",
      count: count(
        (c) => c.computed.rehireStatus === "ELIGIBLE" && !c.computed.isInForce && c.workerType === "Casual",
      ),
      tone: "success",
      href: "/contracts?view=casual-eligible",
    },
    {
      id: "data",
      label: "Rows to fix in the sheet",
      count: dataIssues,
      tone: "info",
      href: "/contracts?view=data-issues",
    },
  ] satisfies AlertGroup[]).filter((group) => group.count > 0);

  const urgent: AlertItem[] = sortByUrgency(latest.filter((contract) => contract.computed.needsAction))
    .slice(0, 4)
    .map((contract) => ({
      id: contract.id,
      name: contract.employeeName || contract.employeeId || contract.id,
      detail: `${contract.company} · ${describeDays(contract.computed.daysRemaining)}`,
      tone: contract.computed.status === "OVERDUE" ? "critical" : "danger",
      href: `/contracts/${encodeURIComponent(contract.id)}`,
    }));

  const total = latest.filter((contract) => contract.computed.needsAction).length + dataIssues;

  return {
    total,
    groups,
    urgent,
    signature: `${total}:${groups.map((group) => `${group.id}${group.count}`).join("|")}`,
  };
}
