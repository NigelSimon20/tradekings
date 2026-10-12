import { readUpload } from "@/lib/api/files";
import { failure, success } from "@/lib/api/respond";
import { parseLicenseUploadForm } from "@/lib/licenses/schema";
import { guardLicenseApi } from "@/lib/services/auth";
import { uploadLicenseDocument } from "@/lib/services/licenses";

/** Uploading to Drive and recording the file can take a few seconds. */
export const maxDuration = 60;

/** Uploads one document or photo to a license or asset. The browser sends files one at a time, so each request stays small. */
export async function POST(request: Request): Promise<Response> {
  const { user, denied } = await guardLicenseApi("editLicenses");
  if (denied) return denied;

  try {
    const read = await readUpload(request, parseLicenseUploadForm);
    if (read.refused) return read.refused;
    const saved = await uploadLicenseDocument(read.values, read.upload!, user.email || user.name);
    return success(`Uploaded “${saved.title}”.`, { id: saved.id });
  } catch (error) {
    return failure(error);
  }
}
