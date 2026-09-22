import "server-only";

import { cache } from "react";

import { getConfig } from "@/lib/config/env";
import { getRepository } from "@/lib/data";
import type { RepositoryHealth } from "@/lib/data/repository";
import { todayIn, type ISODate } from "@/lib/date/dates";
import { sortByUrgency } from "@/lib/domain/filters";
import type { Contract, ContractInput, EvaluatedContract, RunLogEntry } from "@/lib/domain/types";
import { evaluateContracts } from "@/lib/rules/evaluate";
import { getRulesConfig } from "@/lib/services/settings";

export interface ContractsSnapshot {
  /** Every row in the sheet, with the rules applied. */
  contracts: EvaluatedContract[];
  /** Current contract per employee — what the reports and dashboard use. */
  latest: EvaluatedContract[];
  today: ISODate;
  source: { kind: string; label: string };
  /**
   * Why the database could not be read, if it could not be. Reading never
   * throws: a page that cannot reach the sheet should explain itself rather
   * than collapse into a generic error screen.
   */
  error: string | null;
}

/**
 * Loads the database and applies the contract rules. Wrapped in React's `cache`
 * so one page render reads the sheet once, no matter how many components ask.
 */
export const loadSnapshot = cache(async (): Promise<ContractsSnapshot> => {
  const config = getConfig();
  const repository = getRepository();
  const today = todayIn(config.timezone);
  const source = { kind: repository.kind, label: repository.label };

  const { rules } = await getRulesConfig();

  let rows;
  try {
    rows = await repository.listContracts();
  } catch (error) {
    console.error("Could not read the contract database:", error);
    return {
      contracts: [],
      latest: [],
      today,
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const contracts = evaluateContracts(rows, { today, rules });

  return {
    contracts,
    latest: contracts.filter((contract) => contract.computed.isLatest),
    today,
    source,
    error: null,
  };
});

/**
 * Reads straight from storage, bypassing the short read cache. Used by the
 * system check, which writes what it finds back into the sheet.
 */
export async function loadFreshSnapshot(): Promise<ContractsSnapshot> {
  const config = getConfig();
  const repository = getRepository();
  const today = todayIn(config.timezone);
  const source = { kind: repository.kind, label: repository.label };

  const { rules } = await getRulesConfig();
  const rows = await repository.listContracts(true);
  const contracts = evaluateContracts(rows, { today, rules });

  return {
    contracts,
    latest: contracts.filter((contract) => contract.computed.isLatest),
    today,
    source,
    error: null,
  };
}

export async function getContractById(id: string): Promise<EvaluatedContract | null> {
  const { contracts } = await loadSnapshot();
  return contracts.find((contract) => contract.id === id) ?? null;
}

/** Every contract row for an employee, newest first — the history panel. */
export async function getEmployeeHistory(contract: EvaluatedContract): Promise<EvaluatedContract[]> {
  const { contracts } = await loadSnapshot();
  const employeeId = contract.employeeId.trim().toUpperCase();
  if (!employeeId) return [contract];

  return contracts
    .filter(
      (row) =>
        row.employeeId.trim().toUpperCase() === employeeId &&
        row.company === contract.company &&
        row.workerType === contract.workerType,
    )
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
}

export async function createContract(input: ContractInput): Promise<Contract> {
  return getRepository().createContract(input);
}

export async function updateContract(id: string, patch: Partial<ContractInput>): Promise<Contract> {
  return getRepository().updateContract(id, patch);
}

export async function listRunLog(limit = 10): Promise<RunLogEntry[]> {
  return getRepository().listRunLog(limit);
}

export async function checkDataSource(): Promise<RepositoryHealth> {
  return getRepository().healthCheck();
}

/** The most urgent contracts, for the dashboard's action list. */
export function topPriority(contracts: EvaluatedContract[], limit: number): EvaluatedContract[] {
  return sortByUrgency(contracts.filter((contract) => contract.computed.needsAction)).slice(0, limit);
}

export interface CompanyBreakdown {
  company: string;
  workerType: string;
  total: number;
  active: number;
  needsAction: number;
}

export function breakdownByCompany(contracts: EvaluatedContract[]): CompanyBreakdown[] {
  const rows = new Map<string, CompanyBreakdown>();

  for (const contract of contracts) {
    const key = `${contract.company}|${contract.workerType}`;
    const row =
      rows.get(key) ??
      { company: contract.company, workerType: contract.workerType, total: 0, active: 0, needsAction: 0 };
    row.total += 1;
    if (contract.computed.isInForce) row.active += 1;
    if (contract.computed.needsAction) row.needsAction += 1;
    rows.set(key, row);
  }

  return [...rows.values()].sort(
    (a, b) => a.company.localeCompare(b.company) || a.workerType.localeCompare(b.workerType),
  );
}
