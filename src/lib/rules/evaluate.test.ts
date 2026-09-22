import { describe, expect, it } from "vitest";

import { applyRuleOverrides } from "@/lib/config/rules";
import { evaluateContracts } from "@/lib/rules/evaluate";
import { makeContract } from "@/lib/rules/test-helpers";
import type { Contract, FlagCode } from "@/lib/domain/types";

const TODAY = "2026-06-15";

function evaluateOne(overrides: Partial<Contract>) {
  return evaluateContracts([makeContract(overrides)], { today: TODAY })[0];
}

function flagsOf(contract: { computed: { flags: { code: FlagCode }[] } }): FlagCode[] {
  return contract.computed.flags.map((flag) => flag.code);
}

describe("contract status", () => {
  it.each([
    ["2026-08-30", "ACTIVE", 76],
    ["2026-07-15", "EXPIRING_30", 30],
    ["2026-06-30", "EXPIRING_15", 15],
    ["2026-06-15", "EXPIRES_TODAY", 0],
    ["2026-06-14", "EXPIRED", -1],
    ["2026-06-08", "EXPIRED", -7],
    ["2026-06-07", "OVERDUE", -8],
  ])("end date %s is %s", (endDate, status, daysRemaining) => {
    const result = evaluateOne({ startDate: "2026-01-01", endDate });
    expect(result.computed.status).toBe(status);
    expect(result.computed.daysRemaining).toBe(daysRemaining);
  });

  it("marks future contracts as not started", () => {
    const result = evaluateOne({ startDate: "2026-07-01", endDate: "2026-12-31" });
    expect(result.computed.status).toBe("NOT_STARTED");
    expect(result.computed.isInForce).toBe(false);
  });

  it("flags rows with missing or reversed dates instead of guessing", () => {
    expect(evaluateOne({ startDate: null, endDate: "2026-12-31" }).computed.status).toBe("INVALID");
    const reversed = evaluateOne({ startDate: "2026-12-31", endDate: "2026-01-01" });
    expect(reversed.computed.status).toBe("INVALID");
    expect(flagsOf(reversed)).toContain("INVALID_DATES");
  });
});

describe("weekly report persistence", () => {
  it("keeps an expired contract on the action list while it is unresolved", () => {
    const result = evaluateOne({ startDate: "2026-01-01", endDate: "2026-06-01" });
    expect(result.computed.needsAction).toBe(true);
  });

  it("drops it once HR records a decision", () => {
    const result = evaluateOne({
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      renewalStatus: "Not Renewing",
    });
    expect(result.computed.status).toBe("CLOSED");
    expect(result.computed.needsAction).toBe(false);
  });

  it("keeps chasing a contract marked renewed when no follow-on row exists", () => {
    const result = evaluateOne({
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      renewalStatus: "Renewed",
    });
    expect(result.computed.needsAction).toBe(true);
    expect(flagsOf(result)).toContain("RENEWAL_NOT_CAPTURED");
  });

  it("closes the old row once the renewal contract is captured", () => {
    const [previous, current] = evaluateContracts(
      [
        makeContract({ startDate: "2025-07-01", endDate: "2025-12-31" }),
        makeContract({ startDate: "2026-01-01", endDate: "2026-06-30", contractType: "Renewal" }),
      ],
      { today: TODAY },
    );
    expect(previous.computed.status).toBe("RENEWED");
    expect(previous.computed.needsAction).toBe(false);
    expect(previous.computed.isLatest).toBe(false);
    expect(current.computed.contractNumber).toBe(2);
    expect(current.computed.isLatest).toBe(true);
  });
});

describe("Trade Kings blue collar", () => {
  it("allows unlimited renewals", () => {
    const contracts = Array.from({ length: 8 }, (_, index) =>
      makeContract({
        startDate: `20${18 + index}-01-01`,
        endDate: `20${18 + index}-06-30`,
      }),
    );
    const results = evaluateContracts(contracts, { today: TODAY });
    const latest = results[results.length - 1];
    expect(latest.computed.contractCount).toBe(8);
    expect(latest.computed.limitStatus).toBe("NOT_APPLICABLE");
    expect(flagsOf(latest)).not.toContain("ZIM_LIMIT_REACHED");
  });
});

describe("Zimkings blue collar", () => {
  const zimkings = (index: number, overrides: Partial<Contract> = {}) =>
    makeContract({
      company: "Zimkings",
      employeeId: "Z-100",
      startDate: `${2021 + index}-01-01`,
      endDate: `${2021 + index}-12-31`,
      ...overrides,
    });

  it("flags the employee approaching the 5 contract limit", () => {
    const results = evaluateContracts([zimkings(0), zimkings(1), zimkings(2), zimkings(3)], {
      today: TODAY,
    });
    const latest = results[3];
    expect(latest.computed.contractCount).toBe(4);
    expect(latest.computed.contractsRemaining).toBe(1);
    expect(latest.computed.limitStatus).toBe("APPROACHING_LIMIT");
    expect(flagsOf(latest)).toContain("ZIM_LIMIT_APPROACHING");
  });

  it("flags the employee once the limit is reached", () => {
    const results = evaluateContracts(
      [zimkings(0), zimkings(1), zimkings(2), zimkings(3), zimkings(4)],
      { today: TODAY },
    );
    const latest = results[4];
    expect(latest.computed.contractCount).toBe(5);
    expect(latest.computed.contractsRemaining).toBe(0);
    expect(latest.computed.limitStatus).toBe("LIMIT_REACHED");
    expect(flagsOf(latest)).toContain("ZIM_LIMIT_REACHED");
  });

  it("continues from a contract number captured for history", () => {
    const results = evaluateContracts(
      [zimkings(0, { contractNumber: 3 }), zimkings(1), zimkings(2)],
      { today: TODAY },
    );
    expect(results.map((row) => row.computed.contractNumber)).toEqual([3, 4, 5]);
    expect(results[2].computed.limitStatus).toBe("LIMIT_REACHED");
  });

  it("flags a fixed-term contract longer than one year", () => {
    const result = evaluateOne({
      company: "Zimkings",
      startDate: "2026-01-01",
      endDate: "2027-06-30",
    });
    expect(flagsOf(result)).toContain("ZIM_TERM_EXCEEDS_MAX");
  });
});

describe("casual employees", () => {
  const weekly = (weekIndex: number, overrides: Partial<Contract> = {}) => {
    const start = new Date(Date.UTC(2026, 3, 6) + weekIndex * 7 * 86_400_000);
    const end = new Date(start.getTime() + 6 * 86_400_000);
    return makeContract({
      workerType: "Casual",
      contractType: weekIndex === 0 ? "New" : "Renewal",
      employeeId: "CAS-1",
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      ...overrides,
    });
  };

  it("flags the fifth of six weekly contracts as approaching the limit", () => {
    const results = evaluateContracts(
      Array.from({ length: 5 }, (_, index) => weekly(index)),
      { today: "2026-05-06" },
    );
    const latest = results[4];
    expect(latest.computed.contractCount).toBe(5);
    expect(latest.computed.limitStatus).toBe("APPROACHING_LIMIT");
    expect(flagsOf(latest)).toContain("CASUAL_LIMIT_APPROACHING");
  });

  it("calculates the rehire date three months after the sixth contract", () => {
    const results = evaluateContracts(
      Array.from({ length: 6 }, (_, index) => weekly(index)),
      { today: "2026-05-18" },
    );
    const latest = results[5];
    expect(latest.computed.contractCount).toBe(6);
    expect(latest.computed.limitStatus).toBe("LIMIT_REACHED");
    // Sixth contract runs 11–17 May 2026.
    expect(latest.computed.rehireEligibleDate).toBe("2026-08-17");
    expect(latest.computed.rehireStatus).toBe("NOT_ELIGIBLE");
    expect(latest.computed.status).toBe("CLOSED");
    expect(latest.computed.needsAction).toBe(false);
    expect(flagsOf(latest)).toEqual(
      expect.arrayContaining(["CASUAL_LIMIT_REACHED", "CASUAL_WAITING_PERIOD"]),
    );
  });

  it("becomes eligible for rehire once the waiting period is over", () => {
    const results = evaluateContracts(
      Array.from({ length: 6 }, (_, index) => weekly(index)),
      { today: "2026-08-17" },
    );
    const latest = results[5];
    expect(latest.computed.rehireStatus).toBe("ELIGIBLE");
    expect(flagsOf(latest)).toContain("CASUAL_ELIGIBLE_FOR_REHIRE");
  });

  it("starts a fresh count after the three month break", () => {
    const contracts = [
      ...Array.from({ length: 6 }, (_, index) => weekly(index)),
      weekly(0, { startDate: "2026-08-24", endDate: "2026-08-30", contractType: "Rehire" }),
    ];
    const results = evaluateContracts(contracts, { today: "2026-08-26" });
    const latest = results[6];
    expect(latest.computed.contractNumber).toBe(1);
    expect(latest.computed.contractCount).toBe(1);
    expect(latest.computed.limitStatus).toBe("WITHIN_LIMIT");
    expect(latest.computed.rehireStatus).toBe("IN_CONTRACT");
  });

  it("flags a rehire inside the waiting period", () => {
    const contracts = [
      ...Array.from({ length: 6 }, (_, index) => weekly(index)),
      weekly(0, { startDate: "2026-06-01", endDate: "2026-06-07", contractType: "Rehire" }),
    ];
    const results = evaluateContracts(contracts, { today: "2026-06-03" });
    const latest = results[6];
    expect(latest.computed.contractNumber).toBe(7);
    expect(latest.computed.limitStatus).toBe("LIMIT_EXCEEDED");
    expect(flagsOf(latest)).toContain("CASUAL_REHIRED_DURING_WAIT");
  });

  it("keeps contract history separate per company and worker type", () => {
    const results = evaluateContracts(
      [
        makeContract({ employeeId: "SAME-1", company: "Trade Kings", workerType: "Casual" }),
        makeContract({ employeeId: "SAME-1", company: "Zimkings", workerType: "Blue Collar" }),
      ],
      { today: TODAY },
    );
    expect(results[0].computed.contractCount).toBe(1);
    expect(results[1].computed.contractCount).toBe(1);
  });
});

describe("data quality", () => {
  it("flags rows that cannot reach a manager", () => {
    const result = evaluateOne({ managerEmail: "  " });
    expect(flagsOf(result)).toContain("MISSING_MANAGER_EMAIL");
  });

  it("flags rows without an employee id", () => {
    const result = evaluateOne({ employeeId: "" });
    expect(flagsOf(result)).toContain("MISSING_EMPLOYEE_ID");
  });
});

describe("rules changed by an administrator", () => {
  it("uses the alert windows set on the sheet", () => {
    const rules = applyRuleOverrides({ firstAlertDays: "60", secondAlertDays: "45", overdueAfterDays: "2" });
    const check = (endDate: string) =>
      evaluateContracts([makeContract({ startDate: "2026-01-01", endDate })], { today: TODAY, rules })[0]
        .computed.status;

    expect(check("2026-08-01")).toBe("EXPIRING_30"); // 47 days out — inside the new 60 day window
    expect(check("2026-07-01")).toBe("EXPIRING_15"); // 16 days out — inside the new 45 day window
    expect(check("2026-06-12")).toBe("OVERDUE"); // 3 days past, overdue now kicks in after 2
  });

  it("applies a changed Zimkings contract limit", () => {
    const rules = applyRuleOverrides({ zkMaxContracts: "3" });
    const contracts = Array.from({ length: 3 }, (_, index) =>
      makeContract({
        company: "Zimkings",
        employeeId: "Z-200",
        startDate: `${2023 + index}-01-01`,
        endDate: `${2023 + index}-12-31`,
      }),
    );
    const results = evaluateContracts(contracts, { today: TODAY, rules });
    expect(results[2].computed.limitStatus).toBe("LIMIT_REACHED");
    expect(flagsOf(results[2])).toContain("ZIM_LIMIT_REACHED");
  });

  it("applies a changed casual limit and waiting period", () => {
    const rules = applyRuleOverrides({ casualMaxContracts: "3", casualWaitMonths: "1" });
    const weekly = (index: number) =>
      makeContract({
        workerType: "Casual",
        employeeId: "CAS-9",
        startDate: `2026-05-${String(4 + index * 7).padStart(2, "0")}`,
        endDate: `2026-05-${String(10 + index * 7).padStart(2, "0")}`,
      });
    const results = evaluateContracts([weekly(0), weekly(1), weekly(2)], { today: "2026-05-25", rules });
    const latest = results[2];
    expect(latest.computed.contractCount).toBe(3);
    expect(latest.computed.limitStatus).toBe("LIMIT_REACHED");
    expect(latest.computed.rehireEligibleDate).toBe("2026-06-24"); // one month after the last contract
  });
});
