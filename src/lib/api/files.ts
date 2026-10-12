import "server-only";

import { failure } from "@/lib/api/respond";
import type { Parsed } from "@/lib/forms/fields";
import type { FileContent } from "@/lib/files/store";

/**
 * The two halves of every tracker's file routes: reading one uploaded file
 * with its form fields, and streaming a stored file back for preview.
 */

export interface Upload {
  name: string;
  bytes: Uint8Array;
}

/** The uploaded file (if any) and the validated fields, or the 400 to send back. */
export async function readUpload<T>(
  request: Request,
  parse: (form: FormData) => Parsed<T>,
  options: { required?: boolean } = {},
): Promise<{ upload: Upload | null; values: T; refused: null } | { refused: Response }> {
  const { required = true } = options;
  const form = await request.formData();
  const file = form.get("file");
  const present = file instanceof File && file.size > 0;
  if (required && !present) return { refused: failure("Choose a document or photo to upload.", 400) };
  const parsed = parse(form);
  if (!parsed.ok || !parsed.values) {
    return { refused: failure(Object.values(parsed.errors)[0] ?? "Check the details and try again.", 400) };
  }
  return {
    upload: present ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null,
    values: parsed.values,
    refused: null,
  };
}

/**
 * A stored file, shown inline. An image can never run anything; the sandbox
 * is belt and braces. `cache` is "no-store" for files that are sensitive.
 */
export function fileResponse(file: (FileContent & { name: string }) | null, cache = "private, max-age=3600"): Response {
  if (!file) return failure("That file was not found.", 404);
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.mimeType,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "cache-control": cache,
      "x-content-type-options": "nosniff",
      ...(file.mimeType.startsWith("image/") ? { "content-security-policy": "default-src 'none'; sandbox" } : {}),
    },
  });
}
