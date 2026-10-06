import { originFromRequest } from "@/lib/api/origin";
import { failure, success } from "@/lib/api/respond";
import { guardExpatApi } from "@/lib/services/auth";
import { runExpatReminders } from "@/lib/services/expats";

export const maxDuration = 60;

/** "Send reminders now" on Setup & access: the daily run, on demand. */
export async function POST(request: Request): Promise<Response> {
  const { user, denied } = await guardExpatApi("manageExpats");
  if (denied) return denied;

  try {
    const result = await runExpatReminders({ appUrl: originFromRequest(request), actor: user.email || user.name });
    if (!result.due) return success("Nothing is due — every reminder has already been sent.", { result });
    if (!result.sent && result.failures.length) return failure(result.failures.join("; "), 409);
    if (result.failures.length) {
      return failure(`Sent ${result.sent} reminder(s), but some failed: ${result.failures.join("; ")}`, 502);
    }
    return success(`Sent ${result.sent} reminder(s) to ${result.recipients.length} recipient(s).`, { result });
  } catch (error) {
    return failure(error);
  }
}
