import { readUpload } from "@/lib/api/files";
import { failure, success } from "@/lib/api/respond";
import { parseUploadForm } from "@/lib/expats/schema";
import { guardExpatApi } from "@/lib/services/auth";
import { uploadExpatDocument } from "@/lib/services/expats";

/** Uploading to Drive and recording the file can take a few seconds. */
export const maxDuration = 60;

/** Uploads one document to an expat or dependant. The browser sends files one at a time, so each request stays small. */
export async function POST(request: Request): Promise<Response> {
  const { user, denied } = await guardExpatApi("editExpats");
  if (denied) return denied;

  try {
    const read = await readUpload(request, parseUploadForm);
    if (read.refused) return read.refused;
    const saved = await uploadExpatDocument(read.values, read.upload!, user.email || user.name);
    return success(`Uploaded “${saved.title}”.`, { id: saved.id });
  } catch (error) {
    return failure(error);
  }
}
