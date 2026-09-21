import { failure, success } from "@/lib/api/respond";
import { runSystemCheck } from "@/lib/services/system-check";

/** Report runs and sheet write-back can take longer than the default budget. */
export const maxDuration = 60;

/** Manual "Run system check" from the dashboard. */
export async function POST(): Promise<Response> {
  try {
    const result = await runSystemCheck({ trigger: "manual" });
    return success(
      `Checked ${result.rowsChecked} contract rows — ${result.needsAction} require attention, ${result.rowsWritten} rows refreshed${result.dashboardWritten ? ", Dashboard tab updated" : ""}${result.dataIssues ? `, ${result.dataIssues} rows need fixing` : ""}.`,
      { result },
    );
  } catch (error) {
    return failure(error);
  }
}
