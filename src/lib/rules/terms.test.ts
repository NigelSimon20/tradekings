import { describe, expect, it } from "vitest";

import { applyRuleOverrides } from "@/lib/config/rules";
import { checkTermAgainstRules, defaultEndDate, renewalStartDate } from "@/lib/rules/terms";

describe("default contract length", () => {
  it("gives Trade Kings blue collar six months", () => {
    expect(defaultEndDate("Trade Kings", "Blue Collar", "2026-01-01")).toBe("2026-06-30");
  });

  it("gives Zimkings blue collar the one year maximum", () => {
    expect(defaultEndDate("Zimkings", "Blue Collar", "2026-01-01")).toBe("2026-12-31");
  });

  it("gives casuals one week", () => {
    expect(defaultEndDate("Trade Kings", "Casual", "2026-06-01")).toBe("2026-06-07");
  });

  it("starts a renewal the day after the previous contract ends", () => {
    expect(renewalStartDate("2026-06-30")).toBe("2026-07-01");
  });
});

describe("warnings while capturing a contract", () => {
  it("accepts contracts that follow the rules", () => {
    expect(checkTermAgainstRules("Trade Kings", "Blue Collar", "2026-01-01", "2026-06-30")).toBeNull();
    expect(checkTermAgainstRules("Zimkings", "Blue Collar", "2026-01-01", "2026-12-31")).toBeNull();
    expect(checkTermAgainstRules("Trade Kings", "Casual", "2026-06-01", "2026-06-07")).toBeNull();
  });

  it("warns when a Zimkings contract runs past one year", () => {
    expect(checkTermAgainstRules("Zimkings", "Blue Collar", "2026-01-01", "2027-01-05")).toContain(
      "may not run longer than 12 months",
    );
  });

  it("leaves Trade Kings blue collar lengths to HR", () => {
    expect(checkTermAgainstRules("Trade Kings", "Blue Collar", "2026-01-01", "2027-06-30")).toBeNull();
  });

  it("warns when a casual contract is not a week", () => {
    expect(checkTermAgainstRules("Zimkings", "Casual", "2026-06-01", "2026-06-21")).toContain(
      "run 7 days",
    );
  });

  it("says nothing until both dates are filled in", () => {
    expect(checkTermAgainstRules("Zimkings", "Blue Collar", "", "2027-01-05")).toBeNull();
  });
});

describe("rules changed by an administrator", () => {
  it("follows the numbers set on the sheet instead of the shipped defaults", () => {
    const rules = applyRuleOverrides({
      tkTermMonths: "3",
      casualTermDays: "14",
      zkMaxTermMonths: "6",
    });

    expect(defaultEndDate("Trade Kings", "Blue Collar", "2026-01-01", rules)).toBe("2026-03-31");
    expect(defaultEndDate("Trade Kings", "Casual", "2026-06-01", rules)).toBe("2026-06-14");
    expect(checkTermAgainstRules("Zimkings", "Blue Collar", "2026-01-01", "2026-12-31", rules)).toContain(
      "may not run longer than 6 months",
    );
  });

  it("keeps the default when a value is blank or nonsense", () => {
    const rules = applyRuleOverrides({ tkTermMonths: "", casualMaxContracts: "not a number" });
    expect(rules.ruleSets.TK_BLUE_COLLAR.standardTermMonths).toBe(6);
    expect(rules.ruleSets.CASUAL.maxContracts).toBe(6);
  });

  it("keeps 'approaching the limit' one short of the limit", () => {
    const rules = applyRuleOverrides({ zkMaxContracts: "3", casualMaxContracts: "10" });
    expect(rules.ruleSets.ZK_BLUE_COLLAR.approachingAtCount).toBe(2);
    expect(rules.ruleSets.CASUAL.approachingAtCount).toBe(9);
  });

  it("rewrites the plain-English summary to match", () => {
    const rules = applyRuleOverrides({ zkMaxContracts: "3", firstAlertDays: "45" });
    expect(rules.ruleSets.ZK_BLUE_COLLAR.summary).toContain("Maximum of 3 contracts per employee.");
    expect(rules.ruleSets.ZK_BLUE_COLLAR.summary.join(" ")).toContain("45 days");
  });
});
