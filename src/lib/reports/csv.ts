import { CONTRACT_COLUMNS, calculatedCellValues, inputCellValue } from "@/lib/data/sheet-schema";
import type { InputColumnKey } from "@/lib/data/sheet-schema";
import type { EvaluatedContract } from "@/lib/domain/types";

function escapeCell(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The complete database as CSV, using the same columns as the Google Sheet.
 * Attached to the HR report and available as a download from the UI.
 */
export function contractsToCsv(contracts: EvaluatedContract[]): string {
  const header = CONTRACT_COLUMNS.map((column) => escapeCell(column.header)).join(",");

  const rows = contracts.map((contract) => {
    const calculated = calculatedCellValues(contract);
    return CONTRACT_COLUMNS.map((column) =>
      escapeCell(
        column.kind === "calculated"
          ? calculated[column.key as keyof typeof calculated]
          : inputCellValue(contract, column.key as InputColumnKey),
      ),
    ).join(",");
  });

  return [header, ...rows].join("\r\n");
}

export function csvFilename(prefix: string, today: string): string {
  return `${prefix}-${today}.csv`;
}
