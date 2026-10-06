import { originFromRequest } from "@/lib/api/origin";
import { authoriseCron, failure, success } from "@/lib/api/respond";
import { runExpatReminders } from "@/lib/services/expats";

/** Sending to several recipients can take longer than the default budget. */
export const maxDuration = 60;

/** The daily run that emails expiry reminders for the Expat Tracker. */
export async function GET(request: Request): Promise<Response> {
  const unauthorised = authoriseCron(request);
  if (unauthorised) return unauthorised;

  try {
    const result = await runExpatReminders({ appUrl: originFromRequest(request), actor: "Scheduled run" });
    return success(`Sent ${result.sent} of ${result.due} due reminder(s).`, { result });
  } catch (error) {
    return failure(error);
  }
}
