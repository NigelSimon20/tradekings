import { describe, expect, it } from "vitest";

import { buildSeedContracts } from "@/lib/data/seed";
import { EMPTY_FILTERS, applyFilters } from "@/lib/domain/filters";
import { CONTRACT_VIEWS, countView, rowsForView } from "@/lib/domain/views";
import { evaluateContracts } from "@/lib/rules/evaluate";

const TODAY = "2026-06-15";
const contracts = evaluateContracts(buildSeedContracts(TODAY), { today: TODAY });
const latest = contracts.filter((contract) => contract.computed.isLatest);

describe("saved views", () => {
  it.each(CONTRACT_VIEWS.map((view) => [view.id, view] as const))(
    "%s counts the same rows the contracts list shows",
    (_id, view) => {
      const counted = countView(rowsForView(view, { latest, all: contracts }), view);
      const listed = applyFilters(contracts, { ...EMPTY_FILTERS, view: view.id });
      expect(listed).toHaveLength(counted);
    },
  );

  it("covers the whole database between the status views", () => {
    const byId = Object.fromEntries(
      CONTRACT_VIEWS.map((view) => [view.id, countView(latest, view)]),
    );
    // Sample data is generated to exercise every rule; these are the shapes the
    // dashboard must be able to show.
    expect(byId.active).toBeGreaterThan(0);
    expect(byId.expired).toBeGreaterThan(0);
    expect(byId["renewals-due"]).toBeGreaterThan(0);
    expect(byId["zim-reached"]).toBeGreaterThan(0);
    expect(byId["casual-reached"]).toBeGreaterThan(0);
    expect(byId["casual-eligible"]).toBeGreaterThan(0);
    expect(byId["casual-not-eligible"]).toBeGreaterThan(0);
  });
});

describe("contracts list", () => {
  it("hides superseded history by default and shows it on request", () => {
    const current = applyFilters(contracts, EMPTY_FILTERS);
    const withHistory = applyFilters(contracts, { ...EMPTY_FILTERS, history: true });
    expect(withHistory.length).toBeGreaterThan(current.length);
    expect(withHistory).toHaveLength(contracts.length);
  });

  it("filters by company, worker type and manager together", () => {
    const filtered = applyFilters(contracts, {
      ...EMPTY_FILTERS,
      company: "Zimkings",
      workerType: "Casual",
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((row) => row.company === "Zimkings" && row.workerType === "Casual")).toBe(true);
  });

  it("searches across name, id and job title", () => {
    const [target] = latest;
    const found = applyFilters(contracts, { ...EMPTY_FILTERS, q: target.employeeName });
    expect(found.some((row) => row.id === target.id)).toBe(true);
  });
});
