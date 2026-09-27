/**
 * The billboard tracker's numbers, in one place. The dashboard asks for leases
 * expiring within 30 and 90 days; a notice deadline inside the first window is
 * chased too, because missing it can commit Trade Kings to another term.
 */
export const BILLBOARD_RULES = {
  leaseAlertDays: { first: 90, second: 30 },
  /** How close a notice deadline must be before the site is flagged. */
  noticeAlertDays: 30,
} as const;

export type BillboardRules = typeof BILLBOARD_RULES;
