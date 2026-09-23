import "server-only";

import { revalidatePath } from "next/cache";

import { getRepository } from "@/lib/data";
import { buildImportPlan, type ImportPlan } from "@/lib/data/csv-import";
import { loadSnapshot } from "@/lib/services/contracts";

export interface ImportSummary {
  total: number;
  newRows: number;
  duplicates: number;
  invalid: number;
  missingColumns: string[];
  unknownHeaders: string[];
  /** A few example rows for each outcome, for the preview dialog. */
  samples: {
    new: { line: number; label: string }[];
    duplicates: { line: number; label: string; reason: string }[];
    invalid: { line: number; label: string; reason: string }[];
  };
  /** Set after a commit. */
  imported?: number;
}

function summarise(plan: ImportPlan, imported?: number): ImportSummary {
  return {
    total: plan.total,
    newRows: plan.newRows.length,
    duplicates: plan.duplicates.length,
    invalid: plan.invalid.length,
    missingColumns: plan.missingColumns,
    unknownHeaders: plan.unknownHeaders,
    samples: {
      new: plan.newRows.slice(0, 5).map((row) => ({ line: row.line, label: row.label })),
      duplicates: plan.duplicates.slice(0, 5).map((row) => ({
        line: row.line,
        label: row.label,
        reason: row.errors[0] ?? "Already captured",
      })),
      invalid: plan.invalid.slice(0, 8).map((row) => ({
        line: row.line,
        label: row.label,
        reason: row.errors.join("; "),
      })),
    },
    imported,
  };
}

/** Checks an uploaded file without writing anything. */
export async function previewImport(text: string): Promise<ImportSummary> {
  const { contracts } = await loadSnapshot();
  return summarise(buildImportPlan(text, contracts));
}

/**
 * Writes the new rows from an uploaded file. Rows already in the database are
 * skipped by default, and rows that cannot be read are never written.
 */
export async function commitImport(
  text: string,
  options: { includeDuplicates?: boolean; actor?: string } = {},
): Promise<ImportSummary> {
  const { contracts } = await loadSnapshot();
  const plan = buildImportPlan(text, contracts);

  const toCreate = [
    ...plan.newRows,
    ...(options.includeDuplicates ? plan.duplicates : []),
  ]
    .map((row) => row.values)
    .filter((values): values is NonNullable<typeof values> => values !== null)
    .map((values) => ({ ...values, lastUpdatedBy: options.actor ?? "" }));

  if (!toCreate.length) return summarise(plan, 0);

  const created = await getRepository().createContracts(toCreate);
  revalidatePath("/", "layout");

  return summarise(plan, created.length);
}
