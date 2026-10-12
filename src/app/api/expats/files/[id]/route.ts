import { fileResponse } from "@/lib/api/files";
import { failure } from "@/lib/api/respond";
import { guardExpatApi } from "@/lib/services/auth";
import { readExpatDocument } from "@/lib/services/expats";

/**
 * An expat document — only for people who may see sensitive details. Streamed through the tracker so nothing is shared publicly in Drive,
 * and only for files recorded in the app's Documents tab — never any other Drive id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { denied } = await guardExpatApi("viewSensitive");
  if (denied) return denied;

  try {
    const { id } = await params;
    return fileResponse(await readExpatDocument(decodeURIComponent(id)), "private, no-store");
  } catch (error) {
    return failure(error);
  }
}
