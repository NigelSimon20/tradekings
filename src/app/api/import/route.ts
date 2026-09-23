import { getCurrentUser, guardApi } from "@/lib/services/auth";
import { failure, success } from "@/lib/api/respond";
import { importTemplateCsv } from "@/lib/data/csv-import";
import { commitImport, previewImport } from "@/lib/services/import";

/** Report runs and sheet writes can take longer than the default budget. */
export const maxDuration = 60;

/** A 2 MB file is roughly 10,000 contract rows — far beyond a normal import. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Downloads the import template — for the people who can actually import. */
export async function GET(): Promise<Response> {
  const denied = await guardApi("editContracts");
  if (denied) return denied;

  return new Response(importTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="contract-import-template.csv"',
    },
  });
}

/**
 * Two-step import: `mode=preview` validates the file and reports what would
 * happen, `mode=commit` writes the new rows.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guardApi("editContracts");
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "preview");
    const includeDuplicates = String(form.get("includeDuplicates") ?? "") === "true";

    if (!(file instanceof File)) {
      return failure("Choose a CSV file to import.", 400);
    }
    if (file.size === 0) {
      return failure("That file is empty.", 400);
    }
    if (file.size > MAX_BYTES) {
      return failure("That file is larger than 2 MB. Split it and import in parts.", 413);
    }

    const text = await file.text();

    if (mode === "commit") {
      const actor = await getCurrentUser();
      const summary = await commitImport(text, {
        includeDuplicates,
        actor: actor?.email || actor?.name,
      });
      return success(
        `${summary.imported ?? 0} contract${summary.imported === 1 ? "" : "s"} imported from ${file.name}.`,
        { summary },
      );
    }

    const summary = await previewImport(text);
    return success(`${summary.total} rows read from ${file.name}.`, { summary });
  } catch (error) {
    return failure(error);
  }
}
