import { readUpload } from "@/lib/api/files";
import { failure, success } from "@/lib/api/respond";
import { parseRenewalForm } from "@/lib/licenses/schema";
import { guardLicenseApi } from "@/lib/services/auth";
import { recordRenewal } from "@/lib/services/licenses";

export const maxDuration = 60;

/**
 * Records a renewal, with the renewed certificate when one is attached. Sent
 * as a form upload rather than a server action, because a scanned certificate
 * is larger than a server action accepts.
 */
export async function POST(request: Request): Promise<Response> {
  const { user, denied } = await guardLicenseApi("editLicenses");
  if (denied) return denied;

  try {
    const read = await readUpload(request, parseRenewalForm, { required: false });
    if (read.refused) return read.refused;
    await recordRenewal(read.values, read.upload, user.email || user.name);
    return success("Renewal recorded. The license now shows its new dates.");
  } catch (error) {
    return failure(error);
  }
}
