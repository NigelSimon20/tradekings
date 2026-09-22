import type { SheetSetupResult } from "@/lib/data/sheet-setup";
import type {
  Contract,
  ContractInput,
  DashboardSummary,
  EvaluatedContract,
  RunLogEntry,
} from "@/lib/domain/types";

export interface RepositoryHealth {
  ok: boolean;
  /** One line describing where the data lives. */
  detail: string;
  /** Non-fatal problems, e.g. columns missing from the sheet. */
  warnings: string[];
}

/**
 * The only way the application touches stored data.
 *
 * Two implementations exist: the Google Sheet (production) and a local JSON
 * file (development and demos). Everything above this interface is unaware of
 * which one is in use.
 */
export interface ContractRepository {
  readonly kind: "google-sheets" | "local";
  readonly label: string;
  /**
   * All contract rows. Reads may be served from a short-lived cache; pass
   * `fresh` when the answer must come from storage (e.g. the system check).
   */
  listContracts(fresh?: boolean): Promise<Contract[]>;
  createContract(input: ContractInput): Promise<Contract>;
  /** Bulk create, used by the CSV import. */
  createContracts(inputs: ContractInput[]): Promise<Contract[]>;
  updateContract(id: string, patch: Partial<ContractInput>): Promise<Contract>;
  /** Writes the calculated columns back to storage; returns rows written. */
  writeCalculatedColumns(rows: EvaluatedContract[]): Promise<number>;
  /**
   * Writes the summary view into the sheet. Returns false for data sources
   * that have nowhere to put it.
   */
  writeDashboard(summary: DashboardSummary): Promise<boolean>;
  /** Report settings captured in the sheet, as raw key/value pairs. */
  readSettings(): Promise<Record<string, string>>;
  appendRunLog(entry: RunLogEntry): Promise<void>;
  listRunLog(limit?: number): Promise<RunLogEntry[]>;
  healthCheck(): Promise<RepositoryHealth>;
  /** Creates the tabs, headings and formatting the system expects. */
  setUpStorage(): Promise<SheetSetupResult>;
}

export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}

/** Readable, sortable contract id: `TK-20260921-4F2A`. */
export function generateContractId(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

export function companyPrefix(company: string): string {
  return company === "Zimkings" ? "ZK" : "TK";
}

export function newRunLogId(): string {
  return `RUN-${Date.now().toString(36).toUpperCase()}`;
}
