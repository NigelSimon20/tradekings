import { originFromRequest } from "@/lib/api/origin";
import { authoriseCron, failure, success } from "@/lib/api/respond";
import { runWeeklyReports } from "@/lib/reports/run";
import { runSystemCheck } from "@/lib/services/system-check";

/** Report runs and sheet write-back can take longer than the default budget. */
export const maxDuration = 60;

/**
 * The scheduled weekly run: refresh every calculated field in the sheet, then
 * send the HR and manager reports.
 */
export async function GET(request: Request): Promise<Response> {
  const unauthorised = authoriseCron(request);
  if (unauthorised) return unauthorised;

  try {
    const appUrl = originFromRequest(request);
    const check = await runSystemCheck({ trigger: "cron", appUrl });
    const reports = await runWeeklyReports({ mode: "send", trigger: "cron", appUrl });
    return success(
      `${reports.emailsSent} reports sent for ${check.rowsChecked} contract rows.`,
      { check, reports },
    );
  } catch (error) {
    return failure(error);
  }
}
