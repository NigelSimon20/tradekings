import "server-only";

import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/data";
import { newRunLogId } from "@/lib/data/repository";
import { DATA_QUALITY_FLAGS } from "@/lib/domain/meta";
import { CONTRACT_VIEWS, countView, rowsForView } from "@/lib/domain/views";
import { breakdownByCompany, loadFreshSnapshot } from "@/lib/services/contracts";

export interface SystemCheckResult {
  today: string;
  ranAt: string;
  rowsChecked: number;
  rowsWritten: number;
  /** True when the summary view inside the Google Sheet was refreshed. */
  dashboardWritten: boolean;
  needsAction: number;
  dataIssues: number;
  counts: { id: string; label: string; count: number }[];
  warnings: string[];
  durationMs: number;
}

/**
 * Re-applies the contract rules to every row and writes the calculated columns
 * back to the sheet. Runs on a schedule and from the "Run system check" button.
 */
export async function runSystemCheck(
  options: { trigger?: "cron" | "manual"; appUrl?: string; actor?: string } = {},
): Promise<SystemCheckResult> {
  const startedAt = Date.now();
  const config = getConfig();
  const repository = getRepository();
  const { contracts, latest, today } = await loadFreshSnapshot();
  const warnings: string[] = [];

  let rowsWritten = 0;
  try {
    rowsWritten = await repository.writeCalculatedColumns(contracts);
  } catch (error) {
    warnings.push(`Calculated columns were not written: ${(error as Error).message}`);
  }

  const counts = CONTRACT_VIEWS.map((view) => ({
    id: view.id,
    label: view.label,
    count: countView(rowsForView(view, { latest, all: contracts }), view),
  }));

  // The specification asks for the summary view to live in the sheet as well as
  // in the app, so it is rebuilt here from the same numbers.
  const ranAt = new Date().toISOString();
  let dashboardWritten = false;
  try {
    dashboardWritten = await repository.writeDashboard({
      today,
      generatedAt: ranAt,
      employees: latest.length,
      appUrl: options.appUrl || config.appUrl,
      rows: counts.map((entry) => ({ label: entry.label, count: entry.count, viewId: entry.id })),
      byCompany: breakdownByCompany(latest),
    });
  } catch (error) {
    warnings.push(`The Dashboard tab was not updated: ${(error as Error).message}`);
  }

  const dataIssues = contracts.filter((contract) =>
    contract.computed.flags.some((flag) => DATA_QUALITY_FLAGS.includes(flag.code)),
  ).length;
  const needsAction = latest.filter((contract) => contract.computed.needsAction).length;

  const result: SystemCheckResult = {
    today,
    ranAt,
    rowsChecked: contracts.length,
    rowsWritten,
    dashboardWritten,
    needsAction,
    dataIssues,
    counts,
    warnings,
    durationMs: Date.now() - startedAt,
  };

  try {
    await repository.appendRunLog({
      id: newRunLogId(),
      runAt: result.ranAt,
      type: "system-check",
      trigger: options.trigger ?? "manual",
      mode: "send",
      recipients: 0,
      emailsSent: 0,
      rowsChecked: result.rowsChecked,
      needsAction,
      errors: warnings,
      note: `${rowsWritten} rows updated${dashboardWritten ? " · dashboard refreshed" : ""} · ${dataIssues} rows need fixing${options.actor ? ` · by ${options.actor}` : ""}`,
    });
  } catch (error) {
    console.error("Could not write the run log:", (error as Error).message);
  }

  return result;
}
