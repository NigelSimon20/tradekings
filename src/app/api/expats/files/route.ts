import { failure, success } from "@/lib/api/respond";
import { parseUploadForm } from "@/lib/expats/schema";
import { guardExpatApi } from "@/lib/services/auth";
import { uploadExpatDocument } from "@/lib/services/expats";

/** Upload requests can take a few seconds to reach Drive. */
export const maxDuration = 60;

/** Uploads one document to an expat or dependant. The browser sends files one at a time. */
export async function POST(request: Request): Promise<Response> {
  const { user, denied } = await guardExpatApi("editExpats");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return failure("Choose a document or photo to upload.", 400);
    const parsed = parseUploadForm(form);
    if (!parsed.ok || !parsed.values) {
      return failure(Object.values(parsed.errors)[0] ?? "Check the upload details.", 400);
    }
    const saved = await uploadExpatDocument(
      parsed.values,
      { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      user.email || user.name,
    );
    return success(`Uploaded “${saved.title}”.`, { id: saved.id });
  } catch (error) {
    return failure(error);
  }
}
