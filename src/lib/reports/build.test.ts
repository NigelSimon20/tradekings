import { describe, expect, it } from "vitest";

import { buildReport, groupByManager } from "@/lib/reports/build";
import { buildSubject, renderReportHtml, renderReportText } from "@/lib/reports/render-email";
import { evaluateContracts } from "@/lib/rules/evaluate";
import { makeContract } from "@/lib/rules/test-helpers";
import type { Contract } from "@/lib/domain/types";

const TODAY = "2026-06-15";

const OPTIONS = {
  today: TODAY,
  appName: "Blue Collar Contract Tracker",
  appUrl: "https://tracker.example.com",
  scope: { kind: "hr" as const, label: "All employees", recipient: "hr@example.com" },
};

function evaluate(contracts: Contract[]) {
  return evaluateContracts(contracts, { today: TODAY }).filter((row) => row.computed.isLatest);
}

describe("weekly report", () => {
  const contracts = evaluate([
    makeContract({ employeeId: "A-1", employeeName: "Overdue Person", endDate: "2026-05-01" }),
    makeContract({ employeeId: "A-2", employeeName: "Today Person", endDate: TODAY }),
    makeContract({ employeeId: "A-3", employeeName: "Soon Person", endDate: "2026-06-25" }),
    makeContract({ employeeId: "A-4", employeeName: "Month Person", endDate: "2026-07-10" }),
    makeContract({ employeeId: "A-5", employeeName: "Fine Person", endDate: "2026-12-31" }),
    makeContract({
      employeeId: "A-6",
      employeeName: "Decided Person",
      endDate: "2026-06-20",
      renewalStatus: "Not Renewing",
    }),
  ]);

  const report = buildReport(contracts, OPTIONS);

  it("categorises contracts by urgency", () => {
    expect(report.sections.map((section) => section.title)).toEqual([
      "Expired / Overdue",
      "Expires Today",
      "Expiring Within 15 Days",
      "Expiring Within 30 Days",
      "Active — no action required",
    ]);
  });

  it("counts every category", () => {
    expect(report.totals).toMatchObject({
      contracts: 6,
      expiredOrOverdue: 1,
      expiringToday: 1,
      expiring15: 2,
      expiring30: 1,
      needsAction: 4,
    });
  });

  it("leaves out contracts where HR has already decided", () => {
    const listed = report.sections
      .filter((section) => section.display === "table")
      .flatMap((section) => section.rows.map((row) => row.employeeName));
    expect(listed).not.toContain("Decided Person");
  });

  it("summarises active contracts as a count rather than a table", () => {
    const active = report.sections.find((section) => section.key === "active");
    expect(active?.display).toBe("count");
  });

  it("writes a subject line naming the outstanding work", () => {
    expect(buildSubject(report)).toBe(
      "Weekly Contract Report — 15 Jun 2026 — 4 requiring attention",
    );
  });

  it("renders the employees into the email", () => {
    const html = renderReportHtml(report, "Africa/Harare");
    expect(html).toContain("Overdue Person");
    expect(html).toContain("Expiring Within 15 Days");
    expect(renderReportText(report)).toContain("Expired / Overdue (1)");
  });

  it("escapes anything typed into the sheet", () => {
    const risky = buildReport(
      evaluate([makeContract({ employeeName: "<script>alert(1)</script>", endDate: "2026-06-20" })]),
      OPTIONS,
    );
    const html = renderReportHtml(risky, "Africa/Harare");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("flag sections", () => {
  it("lists Zimkings employees who have reached the contract limit", () => {
    const zimkings = Array.from({ length: 5 }, (_, index) =>
      makeContract({
        company: "Zimkings",
        employeeId: "Z-9",
        employeeName: "Limit Person",
        startDate: `${2021 + index}-01-01`,
        endDate: `${2021 + index}-12-31`,
      }),
    );
    const report = buildReport(evaluate(zimkings), OPTIONS);
    const section = report.flagSections.find((entry) => entry.key === "flag-ZIM_LIMIT_REACHED");
    expect(section?.rows).toHaveLength(1);
    expect(report.hasContent).toBe(true);
  });
});

describe("manager reports", () => {
  const contracts = evaluate([
    makeContract({ employeeId: "M-1", manager: "Farai", managerEmail: "farai@example.com" }),
    makeContract({ employeeId: "M-2", manager: "Farai", managerEmail: "Farai@Example.com" }),
    makeContract({ employeeId: "M-3", manager: "Nyasha", managerEmail: "nyasha@example.com" }),
    makeContract({ employeeId: "M-4", manager: "No Email", managerEmail: "" }),
  ]);

  it("groups employees by manager email, ignoring case", () => {
    const groups = groupByManager(contracts);
    expect(groups.map((group) => group.email)).toEqual(["farai@example.com", "nyasha@example.com"]);
    expect(groups[0].contracts).toHaveLength(2);
  });

  it("builds a report containing only that manager's employees", () => {
    const group = groupByManager(contracts)[0];
    const report = buildReport(group.contracts, {
      ...OPTIONS,
      scope: { kind: "manager", label: group.name, recipient: group.email },
    });
    expect(report.totals.contracts).toBe(2);
    expect(buildSubject(report)).toContain("Farai");
  });

  it("does not hide anyone: employees without a manager email stay in the HR report", () => {
    const hr = buildReport(contracts, OPTIONS);
    const managerTotals = groupByManager(contracts).reduce(
      (total, group) => total + group.contracts.length,
      0,
    );
    expect(hr.totals.contracts).toBe(4);
    expect(managerTotals).toBe(3);
  });
});
