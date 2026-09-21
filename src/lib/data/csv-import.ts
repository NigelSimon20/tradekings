import {
  CONTRACT_COLUMNS,
  buildColumnIndex,
  isBlankRow,
  parseContractRow,
  type ColumnKey,
} from "@/lib/data/sheet-schema";
import { isISODate } from "@/lib/date/dates";
import type { Contract, ContractInput } from "@/lib/domain/types";

/**
 * Bulk import from a spreadsheet export.
 *
 * The file is matched against the same column headers as the Google Sheet, so
 * an export from this system — or a copy of the sheet itself — can be imported
 * straight back in. Everything here is pure, so the preview the person approves
 * is exactly what the commit writes.
 */
export interface ImportRow {
  /** 1-based row number in the file, including the header. */
  line: number;
  label: string;
  values: ContractInput | null;
  errors: string[];
  status: "new" | "duplicate" | "invalid";
}

export interface ImportPlan {
  total: number;
  rows: ImportRow[];
  newRows: ImportRow[];
  duplicates: ImportRow[];
  invalid: ImportRow[];
  /** Columns from the schema that the file does not provide. */
  missingColumns: string[];
  /** Headers in the file that the system does not recognise. */
  unknownHeaders: string[];
}

/** Columns a row cannot be imported without. */
const REQUIRED: ColumnKey[] = ["employeeId", "employeeName", "startDate", "endDate"];

/** Detects the delimiter Excel used (comma, semicolon or tab). */
function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((candidate) => ({
    candidate,
    count: firstLine.split(candidate).length - 1,
  }));
  return counts.sort((a, b) => b.count - a.count)[0].count > 0
    ? counts.sort((a, b) => b.count - a.count)[0].candidate
    : ",";
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] ?? "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Identity used to spot a contract that is already captured. */
function fingerprint(contract: { employeeId: string; company: string; workerType: string; startDate: string | null }) {
  return [
    contract.employeeId.trim().toUpperCase(),
    contract.company,
    contract.workerType,
    contract.startDate ?? "",
  ].join("|");
}

/**
 * Turns an uploaded file into a reviewable plan: which rows are new, which are
 * already in the database, and which cannot be read.
 */
export function buildImportPlan(text: string, existing: Contract[]): ImportPlan {
  const table = parseCsv(text).filter((row) => !isBlankRow(row));

  if (!table.length) {
    return {
      total: 0,
      rows: [],
      newRows: [],
      duplicates: [],
      invalid: [],
      missingColumns: REQUIRED.map(headerFor),
      unknownHeaders: [],
    };
  }

  const [header, ...body] = table;
  const index = buildColumnIndex(header);
  const missingColumns = REQUIRED.filter((key) => !index.has(key)).map(headerFor);
  const mappedPositions = new Set(index.values());
  const unknownHeaders = header
    .map((value, position) => ({ value: String(value ?? "").trim(), position }))
    .filter((entry) => entry.value && !mappedPositions.has(entry.position))
    .map((entry) => entry.value);

  const seen = new Set(existing.map(fingerprint));
  const rows: ImportRow[] = body.map((values, offset) => {
    const line = offset + 2;
    const contract = parseContractRow(values, index, line);
    const errors: string[] = [...missingColumns.map((column) => `The file has no "${column}" column`)];

    if (!contract.employeeId.trim()) errors.push("Employee ID is required");
    if (!contract.employeeName.trim()) errors.push("Employee name is required");
    if (!isISODate(contract.startDate ?? "")) errors.push("Start date could not be read");
    if (!isISODate(contract.endDate ?? "")) errors.push("End date could not be read");
    if (
      isISODate(contract.startDate ?? "") &&
      isISODate(contract.endDate ?? "") &&
      (contract.endDate as string) < (contract.startDate as string)
    ) {
      errors.push("End date is before the start date");
    }

    const label = `${contract.employeeName || "(no name)"} · ${contract.employeeId || "no ID"}`;

    if (errors.length) {
      return { line, label, values: null, errors, status: "invalid" };
    }

    const key = fingerprint(contract);
    const duplicate = seen.has(key);
    seen.add(key);

    return {
      line,
      label,
      values: toContractInput(contract),
      errors: duplicate ? ["Already in the database (same employee, company and start date)"] : [],
      status: duplicate ? "duplicate" : "new",
    };
  });

  return {
    total: rows.length,
    rows,
    newRows: rows.filter((row) => row.status === "new"),
    duplicates: rows.filter((row) => row.status === "duplicate"),
    invalid: rows.filter((row) => row.status === "invalid"),
    missingColumns,
    unknownHeaders,
  };
}

/** Drops the fields the system owns: the row keeps only what HR captures. */
function toContractInput(contract: Contract): ContractInput {
  const values: Partial<Contract> = { ...contract };
  delete values.id;
  delete values.rowNumber;
  delete values.lastUpdated;
  return values as ContractInput;
}

function headerFor(key: ColumnKey): string {
  return CONTRACT_COLUMNS.find((column) => column.key === key)?.header ?? key;
}

/** Blank CSV with the expected headers and one example row. */
export function importTemplateCsv(): string {
  const inputColumns = CONTRACT_COLUMNS.filter((column) => column.kind === "input" && column.key !== "id");
  const example: Record<string, string> = {
    "Employee ID": "TK-0101",
    "Employee Name": "Tendai Marufu",
    "Employee Email": "tendai.marufu@example.com",
    Company: "Trade Kings",
    "Worker Type": "Blue Collar",
    Department: "Production",
    "Cost Centre": "CC-2100",
    "Job Title": "Machine Operator",
    "Contract Type": "Renewal",
    "Contract Start Date": "2026-01-01",
    "Contract End Date": "2026-06-30",
    "Contract Number": "3",
    "Renewal Status": "Pending",
    "Responsible HR Person": "Rutendo Moyo",
    "Responsible HR Email": "rutendo.moyo@example.com",
    "Direct Manager": "Farai Chikore",
    "Manager Email": "farai.chikore@example.com",
    "Location / Site": "Harare Plant",
    "Notes / Comments": "Optional note",
  };

  const headers = inputColumns.map((column) => column.header);
  const row = headers.map((headerName) => example[headerName] ?? "");
  return [headers.join(","), row.join(",")].join("\r\n");
}
