import {
  ALERT_DAYS,
  OVERDUE_AFTER_DAYS,
  RULE_SETS,
  resolveRuleSetId,
  type RuleSet,
} from "@/lib/config/rules";
import {
  addMonths,
  daysBetween,
  isBefore,
  isISODate,
  isOnOrBefore,
  type ISODate,
} from "@/lib/date/dates";
import {
  ATTENTION_STATUSES,
  RESOLVED_RENEWAL_STATUSES,
  type Contract,
  type ContractComputed,
  type ContractFlag,
  type ContractStatus,
  type EvaluatedContract,
  type LimitStatus,
  type RehireStatus,
  type RuleSetId,
} from "@/lib/domain/types";

export interface EvaluateOptions {
  /** The calendar date the evaluation is run for. */
  today: ISODate;
}

interface Row {
  /** Position in the input array, so results come back in the same order. */
  index: number;
  contract: Contract;
  ruleSetId: RuleSetId;
}

/** A run of contracts with no qualifying break between them. */
interface Cycle {
  rows: Row[];
  /** Sequence number of each row inside the cycle. */
  sequence: number[];
  /** Rows that were captured before the waiting period had finished. */
  earlyRehire: Set<number>;
  /** Total contracts in this cycle. */
  count: number;
}

/**
 * The single entry point of the rules engine.
 *
 * It is a pure function: give it contract rows plus today's date and it returns
 * the same rows with every calculated field attached. Nothing here touches the
 * network, so it can be unit tested and reasoned about on its own.
 */
export function evaluateContracts(
  contracts: Contract[],
  { today }: EvaluateOptions,
): EvaluatedContract[] {
  const rows: Row[] = contracts.map((contract, index) => ({
    index,
    contract,
    ruleSetId: resolveRuleSetId(contract.company, contract.workerType),
  }));

  const results: EvaluatedContract[] = new Array(rows.length);

  for (const group of groupRows(rows).values()) {
    const ordered = [...group].sort(compareRows);
    const ruleSet = RULE_SETS[ordered[0].ruleSetId];
    const cycles = splitIntoCycles(ordered, ruleSet);
    const lastRowIndex = ordered[ordered.length - 1].index;

    for (const cycle of cycles) {
      const rehire = resolveRehire(cycle, ruleSet, today);
      const limitStatus = resolveLimitStatus(cycle.count, ruleSet);

      cycle.rows.forEach((row, position) => {
        // Rows are ordered oldest first, so only the final row of the final
        // cycle has no follow-on contract.
        const isLatest = row.index === lastRowIndex;

        results[row.index] = {
          ...row.contract,
          computed: computeRow({
            row,
            ruleSet,
            today,
            hasLaterContract: !isLatest,
            isLatest,
            contractNumber: cycle.sequence[position],
            contractCount: cycle.count,
            limitStatus,
            rehireStatus: rehire.status,
            rehireEligibleDate: rehire.eligibleDate,
            rehiredDuringWait: cycle.earlyRehire.has(row.index),
          }),
        };
      });
    }
  }

  return results;
}

/**
 * Contract history is tracked per employee, per company, per worker type: a
 * casual who becomes a blue-collar employee starts a fresh contract count.
 */
function groupRows(rows: Row[]): Map<string, Row[]> {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const employeeId = row.contract.employeeId.trim().toUpperCase();
    // Without an employee ID a row cannot be linked to any history, so it
    // stands alone rather than being merged with other unidentified rows.
    const identity = employeeId || `ROW:${row.index}`;
    const key = `${row.contract.company}|${row.contract.workerType}|${identity}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

/** Oldest contract first; rows without a start date sort to the front. */
function compareRows(a: Row, b: Row): number {
  const startA = a.contract.startDate ?? "";
  const startB = b.contract.startDate ?? "";
  if (startA !== startB) return startA < startB ? -1 : 1;
  const endA = a.contract.endDate ?? "";
  const endB = b.contract.endDate ?? "";
  if (endA !== endB) return endA < endB ? -1 : 1;
  return a.index - b.index;
}

/**
 * Casual contracts are counted in cycles: 6 contracts, then a 3 month break.
 * A gap of at least the waiting period starts a fresh count. Blue-collar
 * employees have a single, continuous cycle.
 */
function splitIntoCycles(ordered: Row[], ruleSet: RuleSet): Cycle[] {
  const cycles: Cycle[] = [];
  let rows: Row[] = [];
  let sequence: number[] = [];
  let earlyRehire = new Set<number>();
  let previousEnd: ISODate | null = null;
  let previousSequence = 0;

  const push = () => {
    if (!rows.length) return;
    cycles.push({ rows, sequence, earlyRehire, count: sequence[sequence.length - 1] });
    rows = [];
    sequence = [];
    earlyRehire = new Set<number>();
    previousSequence = 0;
  };

  for (const row of ordered) {
    const { startDate, endDate, contractNumber } = row.contract;
    const waitingMonths = ruleSet.waitingPeriodMonths;

    if (rows.length && waitingMonths !== null && previousEnd && startDate) {
      const nextCycleFrom = addMonths(previousEnd, waitingMonths);
      if (isOnOrBefore(nextCycleFrom, startDate)) {
        push();
        previousEnd = null;
      } else if (previousSequence >= (ruleSet.maxContracts ?? Infinity)) {
        // Re-engaged before the 3 month break was complete.
        earlyRehire.add(row.index);
      }
    }

    // HR may capture a contract number for history that predates the tracker;
    // the sequence never moves backwards.
    const captured = contractNumber && contractNumber > 0 ? contractNumber : 0;
    const next = Math.max(captured, previousSequence + 1);
    rows.push(row);
    sequence.push(next);
    previousSequence = next;
    if (endDate) previousEnd = previousEnd && isBefore(endDate, previousEnd) ? previousEnd : endDate;
  }

  push();
  return cycles;
}

function resolveLimitStatus(count: number, ruleSet: RuleSet): LimitStatus {
  const max = ruleSet.maxContracts;
  if (max === null) return "NOT_APPLICABLE";
  if (count > max) return "LIMIT_EXCEEDED";
  if (count >= max) return "LIMIT_REACHED";
  if (ruleSet.approachingAtCount !== null && count >= ruleSet.approachingAtCount) {
    return "APPROACHING_LIMIT";
  }
  return "WITHIN_LIMIT";
}

/**
 * Casual rehire rules: once the contract limit is reached the employee must be
 * out of the system for the waiting period before they may be engaged again.
 */
function resolveRehire(
  cycle: Cycle,
  ruleSet: RuleSet,
  today: ISODate,
): { status: RehireStatus; eligibleDate: ISODate | null } {
  if (ruleSet.waitingPeriodMonths === null) {
    return { status: "NOT_APPLICABLE", eligibleDate: null };
  }

  const lastRow = cycle.rows[cycle.rows.length - 1].contract;
  const lastEnd = latestEnd(cycle);
  const reachedLimit = ruleSet.maxContracts !== null && cycle.count >= ruleSet.maxContracts;
  const eligibleDate = reachedLimit && lastEnd ? addMonths(lastEnd, ruleSet.waitingPeriodMonths) : null;

  if (eligibleDate) {
    return {
      status: isOnOrBefore(eligibleDate, today) ? "ELIGIBLE" : "NOT_ELIGIBLE",
      eligibleDate,
    };
  }

  const inForce = isInForce(lastRow, today);
  return { status: inForce ? "IN_CONTRACT" : "ELIGIBLE", eligibleDate: null };
}

function latestEnd(cycle: Cycle): ISODate | null {
  let latest: ISODate | null = null;
  for (const row of cycle.rows) {
    const end = row.contract.endDate;
    if (end && isISODate(end) && (!latest || isBefore(latest, end))) latest = end;
  }
  return latest;
}

function isInForce(contract: Contract, today: ISODate): boolean {
  const { startDate, endDate } = contract;
  if (!startDate || !endDate || !isISODate(startDate) || !isISODate(endDate)) return false;
  return isOnOrBefore(startDate, today) && isOnOrBefore(today, endDate);
}

interface ComputeRowArgs {
  row: Row;
  ruleSet: RuleSet;
  today: ISODate;
  hasLaterContract: boolean;
  isLatest: boolean;
  contractNumber: number;
  contractCount: number;
  limitStatus: LimitStatus;
  rehireStatus: RehireStatus;
  rehireEligibleDate: ISODate | null;
  rehiredDuringWait: boolean;
}

function computeRow(args: ComputeRowArgs): ContractComputed {
  const { row, ruleSet, today, hasLaterContract, isLatest, limitStatus } = args;
  const contract = row.contract;
  const { startDate, endDate } = contract;

  const datesValid =
    !!startDate && !!endDate && isISODate(startDate) && isISODate(endDate) && isOnOrBefore(startDate, endDate);

  const daysRemaining = datesValid ? daysBetween(today, endDate!) : null;
  const termDays = datesValid ? daysBetween(startDate!, endDate!) + 1 : null;

  const limitReached = limitStatus === "LIMIT_REACHED" || limitStatus === "LIMIT_EXCEEDED";
  const status = resolveStatus({
    contract,
    ruleSet,
    today,
    datesValid,
    daysRemaining,
    hasLaterContract,
    limitReached,
  });

  const renewalResolved =
    RESOLVED_RENEWAL_STATUSES.includes(contract.renewalStatus) &&
    // "Renewed" only counts once the follow-on contract is actually captured.
    !(contract.renewalStatus === "Renewed" && !hasLaterContract && (daysRemaining ?? 0) < 0);

  const needsAction = ATTENTION_STATUSES.includes(status) && !renewalResolved;

  return {
    ruleSetId: row.ruleSetId,
    daysRemaining,
    termDays,
    status,
    contractNumber: args.contractNumber,
    contractCount: args.contractCount,
    contractsRemaining:
      ruleSet.maxContracts === null ? null : Math.max(0, ruleSet.maxContracts - args.contractCount),
    limitStatus,
    rehireEligibleDate: args.rehireEligibleDate,
    rehireStatus: args.rehireStatus,
    flags: collectFlags({ ...args, status, datesValid, daysRemaining, isLatest }),
    needsAction,
    isLatest,
    isInForce: status !== "CLOSED" && status !== "INVALID" && isInForce(contract, today),
  };
}

function resolveStatus(args: {
  contract: Contract;
  ruleSet: RuleSet;
  today: ISODate;
  datesValid: boolean;
  daysRemaining: number | null;
  hasLaterContract: boolean;
  limitReached: boolean;
}): ContractStatus {
  const { contract, ruleSet, today, datesValid, daysRemaining, hasLaterContract, limitReached } = args;

  if (!datesValid) return "INVALID";
  // A newer contract for the same employee means this one has been renewed.
  if (hasLaterContract) return "RENEWED";

  const days = daysRemaining as number;
  const ended = days < 0;

  if (ended && (contract.renewalStatus === "Not Renewing" || contract.renewalStatus === "Terminated")) {
    return "CLOSED";
  }
  // A casual who has completed the allowed run cannot be renewed — the rehire
  // eligibility date takes over from here.
  if (ended && limitReached && ruleSet.waitingPeriodMonths !== null) return "CLOSED";

  if (isBefore(today, contract.startDate!)) return "NOT_STARTED";
  if (days < -OVERDUE_AFTER_DAYS) return "OVERDUE";
  if (days < 0) return "EXPIRED";
  if (days === 0) return "EXPIRES_TODAY";
  if (days <= ALERT_DAYS.second) return "EXPIRING_15";
  if (days <= ALERT_DAYS.first) return "EXPIRING_30";
  return "ACTIVE";
}

function collectFlags(
  args: ComputeRowArgs & {
    status: ContractStatus;
    datesValid: boolean;
    daysRemaining: number | null;
  },
): ContractFlag[] {
  const { row, ruleSet, today, isLatest, status, datesValid, contractCount, limitStatus } = args;
  const contract = row.contract;
  const flags: ContractFlag[] = [];
  const isCasual = ruleSet.waitingPeriodMonths !== null;
  const max = ruleSet.maxContracts;

  if (!datesValid) flags.push({ code: "INVALID_DATES" });
  if (!contract.employeeId.trim()) flags.push({ code: "MISSING_EMPLOYEE_ID" });
  if (args.rehiredDuringWait) {
    flags.push({
      code: "CASUAL_REHIRED_DURING_WAIT",
      detail: `Contract ${args.contractNumber} captured before the ${ruleSet.waitingPeriodMonths} month break was complete`,
    });
  }

  // Employee-level flags belong on the current contract only, so the weekly
  // report never lists the same person twice.
  if (isLatest) {
    const countDetail = max !== null ? `Contract ${contractCount} of ${max}` : undefined;

    if (limitStatus === "APPROACHING_LIMIT") {
      flags.push({
        code: isCasual ? "CASUAL_LIMIT_APPROACHING" : "ZIM_LIMIT_APPROACHING",
        detail: countDetail,
      });
    }
    if (limitStatus === "LIMIT_REACHED" || limitStatus === "LIMIT_EXCEEDED") {
      flags.push({
        code: isCasual ? "CASUAL_LIMIT_REACHED" : "ZIM_LIMIT_REACHED",
        detail: countDetail,
      });
    }

    if (isCasual) {
      const currentlyEngaged = isInForce(contract, today);
      if (args.rehireStatus === "NOT_ELIGIBLE" && !currentlyEngaged) {
        flags.push({
          code: "CASUAL_WAITING_PERIOD",
          detail: args.rehireEligibleDate ? `Eligible from ${args.rehireEligibleDate}` : undefined,
        });
      }
      if (args.rehireStatus === "ELIGIBLE" && !currentlyEngaged) {
        flags.push({ code: "CASUAL_ELIGIBLE_FOR_REHIRE" });
      }
    }

    if (ruleSet.maxTermMonths !== null && datesValid) {
      const maxEnd = addMonths(contract.startDate!, ruleSet.maxTermMonths);
      if (isBefore(maxEnd, contract.endDate!)) {
        flags.push({
          code: "ZIM_TERM_EXCEEDS_MAX",
          detail: `Ends after the ${ruleSet.maxTermMonths} month maximum (${maxEnd})`,
        });
      }
    }

    if (
      contract.renewalStatus === "Renewed" &&
      (args.daysRemaining ?? 0) < 0 &&
      status !== "RENEWED"
    ) {
      flags.push({ code: "RENEWAL_NOT_CAPTURED" });
    }

    if (!contract.managerEmail.trim() && status !== "CLOSED" && status !== "RENEWED") {
      flags.push({ code: "MISSING_MANAGER_EMAIL" });
    }
  }

  return flags;
}
