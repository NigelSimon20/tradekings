import { describe, expect, it } from "vitest";

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
      "issued weekly",
    );
  });

  it("says nothing until both dates are filled in", () => {
    expect(checkTermAgainstRules("Zimkings", "Blue Collar", "", "2027-01-05")).toBeNull();
  });
});
