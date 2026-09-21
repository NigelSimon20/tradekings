import { authoriseCron, failure, success } from "@/lib/api/respond";
import { runSystemCheck } from "@/lib/services/system-check";

/** Report runs and sheet write-back can take longer than the default budget. */
export const maxDuration = 60;

/** Daily run that keeps the calculated columns in the sheet up to date. */
export async function GET(request: Request): Promise<Response> {
  const unauthorised = authoriseCron(request);
  if (unauthorised) return unauthorised;

  try {
    const result = await runSystemCheck({ trigger: "cron" });
    return success(`Checked ${result.rowsChecked} contract rows.`, { result });
  } catch (error) {
    return failure(error);
  }
}
