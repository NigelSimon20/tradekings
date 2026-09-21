import { defaultEndDateOffset, resolveRuleSet } from "@/lib/config/rules";
import { addDays, addMonths, isISODate, type ISODate } from "@/lib/date/dates";
import type { Company, WorkerType } from "@/lib/domain/types";

/**
 * The end date the rules imply for a new contract: 6 months for Trade Kings
 * blue collar, 1 year for Zimkings, one week for casuals. Used to pre-fill the
 * contract form — HR can always override it.
 */
export function defaultEndDate(
  company: Company,
  workerType: WorkerType,
  startDate: string,
): ISODate | "" {
  if (!isISODate(startDate)) return "";
  const { months, days } = defaultEndDateOffset(resolveRuleSet(company, workerType));
  const withMonths = months ? addMonths(startDate, months) : startDate;
  return addDays(withMonths, days);
}

/** The day a renewal should start: the day after the previous contract ends. */
export function renewalStartDate(previousEnd: string): ISODate | "" {
  return isISODate(previousEnd) ? addDays(previousEnd, 1) : "";
}

/**
 * Checks a proposed contract length against the rules for that employee, for
 * the warning shown while the contract is being captured. Returns null when the
 * dates are fine (or not yet complete).
 */
export function checkTermAgainstRules(
  company: Company,
  workerType: WorkerType,
  startDate: string,
  endDate: string,
): string | null {
  if (!isISODate(startDate) || !isISODate(endDate)) return null;

  const ruleSet = resolveRuleSet(company, workerType);

  if (ruleSet.maxTermMonths !== null) {
    const latestAllowed = addMonths(startDate, ruleSet.maxTermMonths);
    if (endDate > latestAllowed) {
      return `${company} fixed-term contracts may not run longer than ${ruleSet.maxTermMonths} months. The latest allowed end date is ${latestAllowed}.`;
    }
  }

  if (ruleSet.standardTermDays !== null) {
    const expected = addDays(startDate, ruleSet.standardTermDays - 1);
    if (endDate !== expected) {
      return `Casual contracts are issued weekly — a contract starting ${startDate} would normally end ${expected}.`;
    }
  }

  return null;
}
