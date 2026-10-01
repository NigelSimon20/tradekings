import { failure, success } from "@/lib/api/respond";
import { parseLicenseUploadForm } from "@/lib/licenses/schema";
import { getCurrentUser, guardLicenseApi } from "@/lib/services/auth";
import { uploadLicenseDocument } from "@/lib/services/licenses";

/** Upload and preview requests can take a few seconds to reach Drive. */
export const maxDuration = 60;

/** Uploads one document or photo to a license or asset. The browser sends files one at a time. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guardLicenseApi("editLicenses");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return failure("Choose a document or photo to upload.", 400);
    const parsed = parseLicenseUploadForm(form);
    if (!parsed.ok || !parsed.values) {
      return failure(Object.values(parsed.errors)[0] ?? "Check the upload details.", 400);
    }
    const user = await getCurrentUser();
    const saved = await uploadLicenseDocument(
      parsed.values,
      { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      user?.email || user?.name || "",
    );
    return success(`Uploaded “${saved.title}”.`, { id: saved.id });
  } catch (error) {
    return failure(error);
  }
}
