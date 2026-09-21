import { describe, expect, it } from "vitest";

import { buildImportPlan, importTemplateCsv, parseCsv } from "@/lib/data/csv-import";
import { buildSeedContracts } from "@/lib/data/seed";
import { contractsToCsv } from "@/lib/reports/csv";
import { evaluateContracts } from "@/lib/rules/evaluate";
import { makeContract } from "@/lib/rules/test-helpers";

const TODAY = "2026-06-15";

const HEADER =
  "Employee ID,Employee Name,Company,Worker Type,Contract Start Date,Contract End Date,Manager Email";

describe("parseCsv", () => {
  it("reads quoted fields, escaped quotes and CRLF line endings", () => {
    const rows = parseCsv('a,"b,with comma","say ""hi"""\r\n1,2,3\r\n');
    expect(rows).toEqual([
      ["a", "b,with comma", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("handles a byte order mark and semicolon separated exports", () => {
    const rows = parseCsv("﻿one;two;three\n1;2;3");
    expect(rows[0]).toEqual(["one", "two", "three"]);
    expect(rows[1]).toEqual(["1", "2", "3"]);
  });
});

describe("import plan", () => {
  it("accepts rows that match the sheet headings", () => {
    const csv = [
      HEADER,
      "TK-9001,Tariro Mupfumi,Trade Kings,Blue Collar,2026-01-01,2026-06-30,manager@example.com",
      "ZK-9002,Kuda Mpofu,Zimkings,Casual,2026-06-01,2026-06-07,manager@example.com",
    ].join("\n");

    const plan = buildImportPlan(csv, []);
    expect(plan.total).toBe(2);
    expect(plan.newRows).toHaveLength(2);
    expect(plan.invalid).toHaveLength(0);
    expect(plan.newRows[0].values).toMatchObject({
      employeeId: "TK-9001",
      company: "Trade Kings",
      workerType: "Blue Collar",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
    });
  });

  it("reads dates written the way people type them", () => {
    const csv = [HEADER, "TK-9003,Ruvimbo Zhou,Trade Kings,Blue Collar,01/02/2026,31/07/2026,m@example.com"].join("\n");
    expect(buildImportPlan(csv, []).newRows[0].values).toMatchObject({
      startDate: "2026-02-01",
      endDate: "2026-07-31",
    });
  });

  it("reports rows it cannot read instead of importing them", () => {
    const csv = [
      HEADER,
      ",No Id,Trade Kings,Blue Collar,2026-01-01,2026-06-30,m@example.com",
      "TK-9004,,Trade Kings,Blue Collar,2026-01-01,2026-06-30,m@example.com",
      "TK-9005,Bad Dates,Trade Kings,Blue Collar,not-a-date,2026-06-30,m@example.com",
      "TK-9006,Backwards,Trade Kings,Blue Collar,2026-06-30,2026-01-01,m@example.com",
    ].join("\n");

    const plan = buildImportPlan(csv, []);
    expect(plan.invalid).toHaveLength(4);
    expect(plan.newRows).toHaveLength(0);
    expect(plan.invalid[0].errors).toContain("Employee ID is required");
    expect(plan.invalid[3].errors).toContain("End date is before the start date");
  });

  it("names the columns the file is missing", () => {
    const plan = buildImportPlan("Employee ID,Employee Name\nTK-1,Someone", []);
    expect(plan.missingColumns).toEqual(["Contract Start Date", "Contract End Date"]);
    expect(plan.invalid).toHaveLength(1);
  });

  it("lists headings it does not recognise", () => {
    const csv = [`${HEADER},Payroll Number`, "TK-9007,Nyarai Moyo,Trade Kings,Blue Collar,2026-01-01,2026-06-30,m@example.com,884"].join("\n");
    expect(buildImportPlan(csv, []).unknownHeaders).toEqual(["Payroll Number"]);
  });

  it("spots contracts that are already captured", () => {
    const existing = [
      makeContract({
        employeeId: "TK-9001",
        company: "Trade Kings",
        workerType: "Blue Collar",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
      }),
    ];
    const csv = [
      HEADER,
      "TK-9001,Tariro Mupfumi,Trade Kings,Blue Collar,2026-01-01,2026-06-30,m@example.com",
      "TK-9001,Tariro Mupfumi,Trade Kings,Blue Collar,2026-07-01,2026-12-31,m@example.com",
    ].join("\n");

    const plan = buildImportPlan(csv, existing);
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.newRows).toHaveLength(1);
    expect(plan.newRows[0].values?.startDate).toBe("2026-07-01");
  });

  it("spots the same contract twice inside one file", () => {
    const row = "TK-9008,Repeat Person,Trade Kings,Blue Collar,2026-01-01,2026-06-30,m@example.com";
    const plan = buildImportPlan([HEADER, row, row].join("\n"), []);
    expect(plan.newRows).toHaveLength(1);
    expect(plan.duplicates).toHaveLength(1);
  });

  it("round-trips: exporting the database and importing it back changes nothing", () => {
    const contracts = buildSeedContracts(TODAY);
    const evaluated = evaluateContracts(contracts, { today: TODAY });
    const plan = buildImportPlan(contractsToCsv(evaluated), contracts);

    expect(plan.total).toBe(contracts.length);
    expect(plan.duplicates).toHaveLength(contracts.length);
    expect(plan.newRows).toHaveLength(0);
    expect(plan.invalid).toHaveLength(0);
    expect(plan.unknownHeaders).toEqual([]);
  });

  it("ships a template that imports cleanly", () => {
    const plan = buildImportPlan(importTemplateCsv(), []);
    expect(plan.missingColumns).toEqual([]);
    expect(plan.newRows).toHaveLength(1);
  });
});
