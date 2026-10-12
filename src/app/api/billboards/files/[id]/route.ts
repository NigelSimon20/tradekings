import { fileResponse } from "@/lib/api/files";
import { failure } from "@/lib/api/respond";
import { guardBillboardApi } from "@/lib/services/auth";
import { readBillboardFile } from "@/lib/services/billboards";

/**
 * A billboard photo or document, for preview. Streamed through the tracker so nothing is shared publicly in Drive,
 * and only for files recorded in the app's Documents tab — never any other Drive id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { denied } = await guardBillboardApi("viewBillboards");
  if (denied) return denied;

  try {
    const { id } = await params;
    return fileResponse(await readBillboardFile(decodeURIComponent(id)));
  } catch (error) {
    return failure(error);
  }
}
