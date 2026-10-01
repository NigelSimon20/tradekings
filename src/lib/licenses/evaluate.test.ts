import { describe, expect, it } from "vitest";

import { evaluateLicenses, summariseAssets } from "@/lib/licenses/evaluate";
import { EMPTY_LICENSE_FILTERS, filterLicenses, sortLicensesByUrgency } from "@/lib/licenses/filters";
import { parseReminderDays } from "@/lib/licenses/rules";
import { parseDocumentLinkForm, parseLicenseForm } from "@/lib/licenses/schema";
import type { Asset, License, LicenseDocument } from "@/lib/licenses/types";
import { LICENSE_VIEWS, getLicenseView } from "@/lib/licenses/views";

const TODAY = "2026-10-01";

const warehouse: Asset = {
  id: "AS-001",
  name: "Msasa Warehouse",
  type: "Warehouse",
  company: "Trade Kings",
  department: "Logistics",
  address: "12 Cripps Road, Msasa",
  city: "Harare",
  latitude: -17.84,
  longitude: 31.12,
  registration: "",
  responsibleName: "",
  responsibleEmail: "",
  notes: "",
  archived: false,
  lastUpdated: "",
  lastUpdatedBy: "",
};

const truck: Asset = {
  ...warehouse,
  id: "AS-002",
  name: "Truck 14",
  type: "Truck",
  registration: "AEZ 1234",
  address: "Fleet yard, Belmont",
  city: "Bulawayo",
  latitude: null,
  longitude: null,
};

function license(overrides: Partial<License> = {}): License {
  return {
    id: "LIC-001",
    name: "Fire certificate — Msasa",
    category: "Warehouses & Sites",
    type: "Fire certificate",
    number: "FC-2026-118",
    assetId: "AS-001",
    issuingAuthority: "City of Harare Fire Brigade",
    issueDate: "2026-01-15",
    expiryDate: "2027-01-14",
    renewalFrequency: "Annual",
    renewalStatus: "Not started",
    department: "Logistics",
    responsibleName: "Tendai Marufu",
    responsibleEmail: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    conditions: "",
    lastRenewalDate: null,
    archived: false,
    lastUpdated: "",
    lastUpdatedBy: "",
    ...overrides,
  };
}

const certificate = (licenseId: string): LicenseDocument => ({
  id: `D-${licenseId}`,
  licenseId,
  assetId: "",
  category: "License / certificate",
  title: "Certificate",
  url: "",
  storedFileId: "file",
  mimeType: "application/pdf",
  documentDate: null,
  addedAt: "",
  addedBy: "",
  removed: false,
});

const evaluate = (licenses: License[], documents: LicenseDocument[] = [], reminderDays?: number[]) =>
  evaluateLicenses(
    { assets: [warehouse, truck], licenses, documents },
    { today: TODAY, rules: reminderDays ? { reminderDays } : undefined },
  );
const one = (overrides: Partial<License> = {}) => evaluate([license(overrides)], [certificate("LIC-001")])[0];
const codes = (overrides: Partial<License> = {}) => one(overrides).computed.flags.map((flag) => flag.code);

describe("license status", () => {
  it("is active outside the reminder windows", () => {
    expect(one().computed).toMatchObject({ status: "ACTIVE", daysRemaining: 105, reminderDays: null, needsAction: false });
  });

  it("enters the tightest reminder window it has reached (90, 60, 30, 7)", () => {
    expect(one({ expiryDate: "2026-12-30" }).computed).toMatchObject({ status: "EXPIRING", reminderDays: 90 }); // 90 days
    expect(one({ expiryDate: "2026-11-30" }).computed).toMatchObject({ reminderDays: 60 }); // 60 days
    expect(one({ expiryDate: "2026-10-26" }).computed).toMatchObject({ reminderDays: 30 }); // 25 days
    expect(one({ expiryDate: "2026-10-08" }).computed).toMatchObject({ reminderDays: 7 }); // 7 days
    expect(one({ expiryDate: TODAY }).computed).toMatchObject({ status: "EXPIRING", reminderDays: 7 });
    expect(one({ expiryDate: "2026-12-31" }).computed.status).toBe("ACTIVE"); // 91 days
  });

  it("uses the reminder days an administrator set", () => {
    const [site] = evaluate([license({ expiryDate: "2026-12-30" })], [], [45, 14]);
    expect(site.computed.status).toBe("ACTIVE");
    const [soon] = evaluate([license({ expiryDate: "2026-10-10" })], [], [45, 14]);
    expect(soon.computed).toMatchObject({ status: "EXPIRING", reminderDays: 14 });
  });

  it("expires the day after its expiry date, and is overdue unless a renewal is lodged", () => {
    expect(one({ expiryDate: "2026-09-30" }).computed).toMatchObject({ status: "EXPIRED", daysRemaining: -1, needsAction: true });
    expect(codes({ expiryDate: "2026-09-30" })).toContain("RENEWAL_OVERDUE");
    expect(codes({ expiryDate: "2026-09-30", renewalStatus: "Submitted to authority" })).toEqual(["RENEWAL_PENDING"]);
    expect(one({ expiryDate: "2026-09-30", renewalStatus: "Not renewing" }).computed.needsAction).toBe(false);
  });

  it("reminds only until the renewal is started", () => {
    expect(codes({ expiryDate: "2026-10-20" })).toContain("REMINDER_DUE");
    expect(codes({ expiryDate: "2026-10-20", renewalStatus: "In progress" })).not.toContain("REMINDER_DUE");
  });

  it("treats a one-off license as never expiring, and a missing expiry as something to fix", () => {
    expect(one({ expiryDate: null, renewalFrequency: "One-off (no expiry)" }).computed).toMatchObject({
      status: "NO_EXPIRY",
      needsAction: false,
    });
    expect(one({ expiryDate: null }).computed).toMatchObject({ status: "NO_DATE", needsAction: true });
  });

  it("works out the next renewal from the last one when no expiry is recorded", () => {
    expect(one({ expiryDate: null, lastRenewalDate: "2026-03-01", renewalFrequency: "Every 6 months" }).computed.nextRenewalDate).toBe(
      "2026-09-01",
    );
    expect(one().computed.nextRenewalDate).toBe("2027-01-14");
  });

  it("notes a missing certificate, a missing owner and a broken asset link", () => {
    const [bare] = evaluate([license({ responsibleName: "", assetId: "AS-999" })]);
    expect(bare.computed.flags.map((flag) => flag.code)).toEqual(["ASSET_MISSING", "NO_DOCUMENT", "NO_RESPONSIBLE_PERSON"]);
    expect(bare.computed.needsAction).toBe(true);
  });
});

describe("assets", () => {
  it("shows each asset's most urgent license, for the map", () => {
    const licenses = evaluate([
      license({ id: "A" }),
      license({ id: "B", expiryDate: "2026-09-01" }),
      license({ id: "C", assetId: "AS-002", expiryDate: "2026-10-20" }),
    ]);
    const [site, vehicle] = summariseAssets([warehouse, truck], licenses);
    expect(site).toMatchObject({ worstStatus: "EXPIRED", needsAction: 1, hasLocation: true });
    expect(vehicle).toMatchObject({ worstStatus: "EXPIRING", hasLocation: false });
  });
});

describe("dashboard and register", () => {
  const licenses = evaluate([
    license({ id: "ok" }),
    license({ id: "soon", expiryDate: "2026-10-20" }),
    license({ id: "gone", expiryDate: "2026-08-01" }),
    license({ id: "lodged", expiryDate: "2026-10-05", renewalStatus: "Submitted to authority" }),
    license({
      id: "truck",
      name: "Roadworthiness — Truck 14",
      number: "RW-7781",
      assetId: "AS-002",
      issuingAuthority: "Vehicle Inspectorate",
      type: "Roadworthiness certificate",
      category: "Trucks & Vehicles",
      department: "Fleet",
      expiryDate: "2027-06-01",
    }),
  ]);
  const count = (id: string) => licenses.filter(getLicenseView(id)!.matches).length;

  it("counts each tile from its own rule", () => {
    expect(count("active")).toBe(4);
    expect(count("expiring")).toBe(2);
    expect(count("expired")).toBe(1);
    expect(count("pending")).toBe(1);
    expect(count("action")).toBe(2);
    expect(count("upcoming")).toBe(2);
  });

  it("gives the register exactly the rows each tile counted", () => {
    for (const view of LICENSE_VIEWS) {
      expect(filterLicenses(licenses, { ...EMPTY_LICENSE_FILTERS, view: view.id })).toHaveLength(count(view.id));
    }
  });

  it("filters by location, asset type, license type, department and status", () => {
    const ids = (filters: Partial<typeof EMPTY_LICENSE_FILTERS>) =>
      filterLicenses(licenses, { ...EMPTY_LICENSE_FILTERS, ...filters }).map((item) => item.id);
    expect(ids({ location: "Bulawayo" })).toEqual(["truck"]);
    expect(ids({ assetType: "Truck" })).toEqual(["truck"]);
    expect(ids({ type: "Roadworthiness certificate" })).toEqual(["truck"]);
    expect(ids({ department: "fleet" })).toEqual(["truck"]);
    expect(ids({ status: "EXPIRED" })).toEqual(["gone"]);
  });

  it("finds a license by its number, the vehicle registration or the site", () => {
    const find = (q: string) => filterLicenses(licenses, { ...EMPTY_LICENSE_FILTERS, q }).map((item) => item.id);
    expect(find("aez 1234")).toEqual(["truck"]);
    expect(find("FC-2026-118")).toHaveLength(4);
    expect(find("msasa")).toHaveLength(4);
    expect(find("aez 1234 msasa")).toEqual([]);
  });

  it("lists the most urgent first", () => {
    expect(sortLicensesByUrgency(licenses).map((item) => item.id)).toEqual(["gone", "lodged", "soon", "ok", "truck"]);
  });
});

describe("settings and forms", () => {
  it("reads reminder days as typed, keeping the defaults for nonsense", () => {
    expect(parseReminderDays("30, 90 7,60")).toEqual([90, 60, 30, 7]);
    expect(parseReminderDays("14")).toEqual([14]);
    expect(parseReminderDays("soon")).toEqual([90, 60, 30, 7]);
    expect(parseReminderDays("")).toEqual([90, 60, 30, 7]);
  });

  it("refuses a script link and an expiry before the issue date", () => {
    const form = new FormData();
    form.set("licenseId", "LIC-001");
    form.set("category", "License / certificate");
    form.set("title", "Cert");
    form.set("url", "javascript:alert(1)");
    expect(parseDocumentLinkForm(form).errors.url).toBeTruthy();

    const bad = new FormData();
    for (const [key, value] of Object.entries({ name: "X", category: "Trucks & Vehicles", type: "Vehicle license", issueDate: "2026-05-01", expiryDate: "2026-04-01" })) {
      bad.set(key, value);
    }
    expect(parseLicenseForm(bad).errors.expiryDate).toBeTruthy();
  });
});
