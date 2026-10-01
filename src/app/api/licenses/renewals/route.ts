import { failure, success } from "@/lib/api/respond";
import { parseRenewalForm } from "@/lib/licenses/schema";
import { getCurrentUser, guardLicenseApi } from "@/lib/services/auth";
import { recordRenewal } from "@/lib/services/licenses";

export const maxDuration = 60;

/**
 * Records a renewal, with the renewed certificate when one is attached. Sent
 * as a form upload rather than a server action, because a scanned certificate
 * is larger than a server action accepts.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guardLicenseApi("editLicenses");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const parsed = parseRenewalForm(form);
    if (!parsed.ok || !parsed.values) {
      return failure(Object.values(parsed.errors)[0] ?? "Check the renewal details.", 400);
    }
    const file = form.get("file");
    const certificate =
      file instanceof File && file.size > 0 ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null;
    const user = await getCurrentUser();
    await recordRenewal(parsed.values, certificate, user?.email || user?.name || "");
    return success("Renewal recorded. The license now shows its new dates.");
  } catch (error) {
    return failure(error);
  }
}
