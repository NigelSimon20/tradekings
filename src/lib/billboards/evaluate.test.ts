import { describe, expect, it } from "vitest";

import { evaluateBillboards } from "@/lib/billboards/evaluate";
import { filterBillboards, EMPTY_BILLBOARD_FILTERS } from "@/lib/billboards/filters";
import { isSafeUrl, parseBillboardForm } from "@/lib/billboards/schema";
import type { Billboard, BillboardFile, Campaign } from "@/lib/billboards/types";
import { BILLBOARD_VIEWS, getBillboardView } from "@/lib/billboards/views";

const TODAY = "2026-09-25";

function parseBillboardFormForTest(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return parseBillboardForm(form);
}

function billboard(overrides: Partial<Billboard> = {}): Billboard {
  return {
    id: "BB-001",
    name: "Samora Machel / Julius Nyerere",
    address: "Corner Samora Machel Ave & Julius Nyerere Way",
    city: "Harare",
    area: "CBD",
    road: "Samora Machel Avenue",
    latitude: -17.8292,
    longitude: 31.0522,
    type: "Static billboard",
    dimensions: "12m x 4m",
    faces: 2,
    status: "Active",
    owner: "City Properties",
    leaseStart: "2025-01-01",
    leaseExpiry: "2027-12-31",
    leaseCost: "USD 1,200 / month",
    noticePeriodDays: null,
    renewalNotes: "",
    leaseDocumentUrl: "https://drive.google.com/file/d/lease",
    landlordName: "",
    landlordPhone: "",
    landlordEmail: "",
    councilName: "",
    councilPhone: "",
    councilEmail: "",
    contractorName: "",
    contractorPhone: "",
    contractorEmail: "",
    responsibleName: "",
    responsibleEmail: "",
    siteCondition: "Good",
    lastInspection: "2026-08-01",
    nextInspection: "2026-11-01",
    maintenanceIssues: "",
    maintenanceNotes: "",
    followUp: false,
    followUpNote: "",
    notes: "",
    archived: false,
    lastUpdated: "",
    lastUpdatedBy: "",
    ...overrides,
  };
}

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "CMP-1",
    billboardId: "BB-001",
    brand: "Boom",
    campaign: "Washing paste",
    startDate: "2026-09-01",
    endDate: "2026-10-31",
    installedOn: "2026-09-01",
    removedOn: null,
    artworkUrl: "",
    notes: "",
    recordedAt: "",
    recordedBy: "",
    ...overrides,
  };
}

function evaluate(
  billboards: Billboard[],
  campaigns: Campaign[] = [],
  files: BillboardFile[] = [],
) {
  return evaluateBillboards({ billboards, campaigns, files }, { today: TODAY });
}

const one = (overrides: Partial<Billboard> = {}, campaigns: Campaign[] = []) =>
  evaluate([billboard(overrides)], campaigns)[0];

const codes = (overrides: Partial<Billboard> = {}, campaigns: Campaign[] = []) =>
  one(overrides, campaigns).computed.flags.map((flag) => flag.code);

describe("lease status", () => {
  it("counts down to the expiry date", () => {
    expect(one().computed).toMatchObject({ leaseStatus: "ACTIVE", leaseDaysRemaining: 462 });
  });

  it("warns at 90 days and escalates at 30, inclusive", () => {
    expect(one({ leaseExpiry: "2026-12-24" }).computed.leaseStatus).toBe("EXPIRING_90"); // 90 days
    expect(one({ leaseExpiry: "2026-12-25" }).computed.leaseStatus).toBe("ACTIVE"); // 91 days
    expect(one({ leaseExpiry: "2026-10-25" }).computed.leaseStatus).toBe("EXPIRING_30"); // 30 days
    expect(one({ leaseExpiry: TODAY }).computed.leaseStatus).toBe("EXPIRING_30");
  });

  it("expires the day after the expiry date", () => {
    expect(one({ leaseExpiry: "2026-09-24" }).computed).toMatchObject({
      leaseStatus: "EXPIRED",
      leaseDaysRemaining: -1,
    });
    expect(codes({ leaseExpiry: "2026-09-24" })).toContain("LEASE_EXPIRED");
  });

  it("treats a lease with a start but no end as running", () => {
    expect(one({ leaseExpiry: null }).computed.leaseStatus).toBe("ACTIVE");
    expect(one({ leaseStart: null, leaseExpiry: null }).computed.leaseStatus).toBe("NO_LEASE");
  });
});

describe("notice deadline", () => {
  it("is the expiry date minus the notice period", () => {
    expect(one({ leaseExpiry: "2027-03-31", noticePeriodDays: 90 }).computed.noticeDeadline).toBe(
      "2026-12-31",
    );
  });

  it("is flagged once it is within 30 days, before the lease itself is", () => {
    // Lease has 96 days left — no lease flag — but notice is due in 6.
    const flags = codes({ leaseExpiry: "2026-12-30", noticePeriodDays: 90 });
    expect(flags).toContain("NOTICE_DUE");
    expect(flags).not.toContain("LEASE_EXPIRING_30");
    expect(codes({ leaseExpiry: "2027-06-30", noticePeriodDays: 90 })).not.toContain("NOTICE_DUE");
  });

  it("stops being chased once the lease has expired", () => {
    expect(codes({ leaseExpiry: "2026-09-01", noticePeriodDays: 90 })).not.toContain("NOTICE_DUE");
  });
});

describe("current usage", () => {
  it("finds the campaign on the board today", () => {
    const current = campaign({ id: "now" });
    const ended = campaign({ id: "old", startDate: "2026-06-01", endDate: "2026-08-31", removedOn: "2026-09-01" });
    const upcoming = campaign({ id: "next", startDate: "2026-11-01", endDate: null });
    const result = one({}, [ended, current, upcoming]).computed;
    expect(result.currentCampaign?.id).toBe("now");
    expect(result.nextCampaign?.id).toBe("next");
  });

  it("treats a campaign taken down early as no longer running", () => {
    expect(one({}, [campaign({ removedOn: "2026-09-20" })]).computed.currentCampaign).toBeNull();
  });

  it("flags a campaign left up past its end date", () => {
    const stale = campaign({ startDate: "2026-06-01", endDate: "2026-08-31" });
    expect(codes({}, [stale])).toContain("CAMPAIGN_NOT_REMOVED");
    expect(codes({}, [{ ...stale, removedOn: "2026-09-02" }])).not.toContain("CAMPAIGN_NOT_REMOVED");
  });
});

describe("maintenance and follow-up", () => {
  it("flags an inspection date that has passed", () => {
    expect(codes({ nextInspection: "2026-09-24" })).toContain("INSPECTION_OVERDUE");
    expect(codes({ nextInspection: TODAY })).not.toContain("INSPECTION_OVERDUE");
  });

  it("flags poor condition and open issues", () => {
    expect(codes({ siteCondition: "Damaged" })).toContain("CONDITION_POOR");
    expect(codes({ siteCondition: "Fair" })).not.toContain("CONDITION_POOR");
    expect(codes({ maintenanceIssues: "Lights out on the left face" })).toContain("OPEN_ISSUES");
  });

  it("a healthy site needs nothing", () => {
    expect(one().computed.needsFollowUp).toBe(false);
    expect(codes()).toEqual([]);
  });

  it("missing coordinates or lease paperwork are noted but not chased", () => {
    const site = one({ latitude: null, longitude: null, leaseDocumentUrl: "" });
    expect(site.computed.flags.map((flag) => flag.code)).toEqual(["MISSING_LOCATION", "NO_LEASE_DOCUMENT"]);
    expect(site.computed.needsFollowUp).toBe(false);
  });

  it("accepts a lease agreement uploaded as a document instead of the lease link", () => {
    const lease: BillboardFile = {
      id: "F1",
      billboardId: "BB-001",
      category: "Lease agreement",
      title: "Signed lease",
      url: "https://drive.google.com/file/d/x",
      documentDate: null,
      addedAt: "",
      addedBy: "",
      removed: false,
      storedFileId: "",
      mimeType: "",
    };
    const [site] = evaluate([billboard({ leaseDocumentUrl: "" })], [], [lease]);
    expect(site.computed.flags.map((flag) => flag.code)).not.toContain("NO_LEASE_DOCUMENT");
    expect(site.computed.documentCount).toBe(1);

    const [removed] = evaluate([billboard({ leaseDocumentUrl: "" })], [], [{ ...lease, removed: true }]);
    expect(removed.computed.documentCount).toBe(0);
  });

  it("uses the newest uploaded site photo as the cover, never a pasted link", () => {
    const photo = (id: string, addedAt: string, extra: Partial<BillboardFile> = {}): BillboardFile => ({
      id,
      billboardId: "BB-001",
      category: "Site photo",
      title: id,
      url: "",
      documentDate: null,
      addedAt,
      addedBy: "",
      removed: false,
      storedFileId: `drive-${id}`,
      mimeType: "image/jpeg",
      ...extra,
    });
    const files = [
      photo("old", "2026-01-01T08:00:00Z"),
      photo("new", "2026-09-01T08:00:00Z"),
      photo("link", "2026-09-20T08:00:00Z", { storedFileId: "", url: "https://example.com/x.jpg" }),
      photo("gone", "2026-09-21T08:00:00Z", { removed: true }),
      photo("art", "2026-09-22T08:00:00Z", { category: "Campaign artwork" }),
    ];
    expect(evaluate([billboard()], [], files)[0].computed.coverPhotoId).toBe("new");
    expect(evaluate([billboard()])[0].computed.coverPhotoId).toBeNull();
  });
});

describe("dashboard views", () => {
  const sites = evaluate([
    billboard({ id: "A" }),
    billboard({ id: "B", status: "Inactive", leaseExpiry: "2026-09-01" }),
    billboard({ id: "C", status: "Under Maintenance", leaseExpiry: "2026-10-10" }),
    billboard({ id: "D", leaseExpiry: "2026-12-01" }),
  ]);
  const count = (id: string) => sites.filter(getBillboardView(id)!.matches).length;

  it("counts each tile from its own rule", () => {
    expect(count("all")).toBe(4);
    expect(count("active")).toBe(2);
    expect(count("inactive")).toBe(1);
    expect(count("maintenance")).toBe(1);
    expect(count("lease-expired")).toBe(1);
    expect(count("lease-30")).toBe(1);
    expect(count("lease-90")).toBe(2);
    expect(count("follow-up")).toBe(2);
  });

  it("gives the list exactly the rows the tile counted", () => {
    for (const view of BILLBOARD_VIEWS) {
      expect(filterBillboards(sites, { ...EMPTY_BILLBOARD_FILTERS, view: view.id })).toHaveLength(
        count(view.id),
      );
    }
  });
});

describe("search", () => {
  const sites = evaluate(
    [billboard(), billboard({
      id: "BB-002",
      name: "Airport Road",
      address: "Airport Road, near the toll gate",
      road: "Airport Road",
      city: "Bulawayo",
    })],
    [campaign()],
  );
  const search = (q: string) =>
    filterBillboards(sites, { ...EMPTY_BILLBOARD_FILTERS, q }).map((site) => site.id);

  it("finds a site by ID, road, city or the brand on it", () => {
    expect(search("bb-002")).toEqual(["BB-002"]);
    expect(search("samora")).toEqual(["BB-001"]);
    expect(search("bulawayo")).toEqual(["BB-002"]);
    expect(search("boom")).toEqual(["BB-001"]);
  });

  it("needs every word to match", () => {
    expect(search("airport harare")).toEqual([]);
  });
});

describe("links", () => {
  it("only accepts web links", () => {
    expect(isSafeUrl("https://drive.google.com/file/d/abc")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeUrl("drive.google.com/file")).toBe(false);
  });

  it("refuses to save a billboard with a script link", () => {
    const parsed = parseBillboardFormForTest({
      name: "Test",
      city: "Harare",
      leaseDocumentUrl: "javascript:alert(document.cookie)",
    });
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.leaseDocumentUrl).toBeTruthy();
  });

  it("requires both coordinates or neither", () => {
    expect(parseBillboardFormForTest({ name: "T", city: "Harare", latitude: "-17.8" }).errors.longitude).toBeTruthy();
    expect(
      parseBillboardFormForTest({ name: "T", city: "Harare", latitude: "-17.8", longitude: "31.05" }).ok,
    ).toBe(true);
  });
});
