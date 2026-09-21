import { failure, success } from "@/lib/api/respond";
import { runWeeklyReports } from "@/lib/reports/run";

/** Report runs and sheet write-back can take longer than the default budget. */
export const maxDuration = 60;

interface RunBody {
  mode?: "send" | "preview";
  onlyRecipient?: string;
}

/** Manual weekly report run, triggered from the dashboard or reports page. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as RunBody;
    const result = await runWeeklyReports({
      mode: body.mode === "preview" ? "preview" : "send",
      trigger: "manual",
      onlyRecipient: body.onlyRecipient,
    });

    const skipped = result.recipients - result.emailsSent;
    const problems = result.errors.length ? ` Problems: ${result.errors.join("; ")}` : "";
    return success(
      `${result.emailsSent} report${result.emailsSent === 1 ? "" : "s"} sent via ${result.transport}${skipped ? `, ${skipped} skipped` : ""}.${problems}`,
      { result },
    );
  } catch (error) {
    return failure(error);
  }
}
