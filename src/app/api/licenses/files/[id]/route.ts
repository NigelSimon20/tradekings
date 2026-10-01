import { failure } from "@/lib/api/respond";
import { guardLicenseApi } from "@/lib/services/auth";
import { readLicenseDocument } from "@/lib/services/licenses";

/**
 * Streams an uploaded license document so the tracker can show it without the
 * file being shared publicly in Drive — only to people who can see licenses,
 * and only for files recorded in the register.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await guardLicenseApi("viewLicenses");
  if (denied) return denied;

  try {
    const { id } = await params;
    const file = await readLicenseDocument(decodeURIComponent(id));
    if (!file) return failure("That file was not found.", 404);
    const isImage = file.mimeType.startsWith("image/");
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        ...(isImage ? { "content-security-policy": "default-src 'none'; sandbox" } : {}),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
