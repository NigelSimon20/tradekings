import { failure } from "@/lib/api/respond";
import { guardExpatApi } from "@/lib/services/auth";
import { readExpatDocument } from "@/lib/services/expats";

/**
 * Streams an uploaded expat document so the tracker can show it without the
 * file being shared in Drive — only to people who may see sensitive details,
 * and only for files recorded in the Documents tab.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { denied } = await guardExpatApi("viewSensitive");
  if (denied) return denied;

  try {
    const { id } = await params;
    const file = await readExpatDocument(decodeURIComponent(id));
    if (!file) return failure("That file was not found.", 404);
    const isImage = file.mimeType.startsWith("image/");
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        ...(isImage ? { "content-security-policy": "default-src 'none'; sandbox" } : {}),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
