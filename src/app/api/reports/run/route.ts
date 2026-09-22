import { originFromRequest } from "@/lib/api/origin";
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
      appUrl: originFromRequest(request),
    });

    const plural = result.emailsSent === 1 ? "" : "s";
    const skipped = result.recipients - result.emailsSent;
    const outcome =
      result.transportKind === "smtp"
        ? `${result.emailsSent} report${plural} sent`
        : `${result.emailsSent} report${plural} prepared, but not sent — email sending is not set up yet`;
    const problems = result.errors.length ? ` ${result.errors.join("; ")}` : "";

    return success(`${outcome}${skipped ? `, ${skipped} skipped` : ""}.${problems}`, { result });
  } catch (error) {
    return failure(error);
  }
}
