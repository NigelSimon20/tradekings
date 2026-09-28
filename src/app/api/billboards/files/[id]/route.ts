import { failure } from "@/lib/api/respond";
import { guardBillboardApi } from "@/lib/services/auth";
import { readBillboardFile } from "@/lib/services/billboards";

/**
 * Streams an uploaded photo or document so the tracker can preview it without
 * the file being shared publicly in Drive. Only signed-in people with billboard
 * access get it, and only for files recorded against a billboard.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guardBillboardApi("viewBillboards");
  if (denied) return denied;

  try {
    const { id } = await params;
    const file = await readBillboardFile(decodeURIComponent(id));
    if (!file) return failure("That file was not found.", 404);

    const isImage = file.mimeType.startsWith("image/");
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        // An image can never run anything; the sandbox is belt and braces.
        ...(isImage ? { "content-security-policy": "default-src 'none'; sandbox" } : {}),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
