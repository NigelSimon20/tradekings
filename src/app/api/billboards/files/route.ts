import { failure, success } from "@/lib/api/respond";
import { parseUploadForm } from "@/lib/billboards/schema";
import { getCurrentUser, guardBillboardApi } from "@/lib/services/auth";
import { uploadBillboardFile } from "@/lib/services/billboards";

/** Uploading to Drive and recording the file can take a few seconds. */
export const maxDuration = 60;

/**
 * Uploads one photo or document to the billboard's folder. The browser sends
 * files one at a time (photos already shrunk), so each request stays small.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guardBillboardApi("editBillboards");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return failure("Choose a photo or document to upload.", 400);

    const parsed = parseUploadForm(form);
    if (!parsed.ok || !parsed.values) {
      return failure(Object.values(parsed.errors)[0] ?? "Check the upload details.", 400);
    }

    const user = await getCurrentUser();
    const saved = await uploadBillboardFile(
      parsed.values,
      { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      user?.email || user?.name || "",
    );
    return success(`Uploaded “${saved.title}”.`, { id: saved.id });
  } catch (error) {
    return failure(error);
  }
}
