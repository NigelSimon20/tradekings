import { fileResponse } from "@/lib/api/files";
import { failure } from "@/lib/api/respond";
import { guardLicenseApi } from "@/lib/services/auth";
import { readLicenseDocument } from "@/lib/services/licenses";

/**
 * A license document or photo, for preview. Streamed through the tracker so nothing is shared publicly in Drive,
 * and only for files recorded in the app's Documents tab — never any other Drive id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { denied } = await guardLicenseApi("viewLicenses");
  if (denied) return denied;

  try {
    const { id } = await params;
    return fileResponse(await readLicenseDocument(decodeURIComponent(id)));
  } catch (error) {
    return failure(error);
  }
}
