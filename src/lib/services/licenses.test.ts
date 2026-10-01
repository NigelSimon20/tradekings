import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The services are server-only; in a test there is no client bundle to protect.
vi.mock("server-only", () => ({}));

/**
 * The License Tracker end to end through the real services, on the sample-data
 * setup: assets and licenses, a renewal with its certificate, the folder the
 * certificate lands in, reminder days, the audit trail and the export.
 */

let directory: string;
let services: typeof import("@/lib/services/licenses");

const PDF = new TextEncoder().encode("%PDF-1.7\n% renewed certificate\n");

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "licenses-"));
  process.env.LOCAL_LICENSES_FILE = path.join(directory, "licenses.json");
  process.env.LOCAL_LICENSES_UPLOADS_DIR = path.join(directory, "uploads");
  delete process.env.GOOGLE_LICENSES_SHEET_ID;
  delete process.env.GOOGLE_LICENSES_DOCUMENTS_FOLDER_ID;
  services = await import("@/lib/services/licenses");
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

const blankLicense = {
  number: "",
  issuingAuthority: "",
  issueDate: null,
  renewalStatus: "Not started" as const,
  department: "",
  responsibleName: "",
  responsibleEmail: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  conditions: "",
  lastRenewalDate: null,
};

describe("the license register", () => {
  it("starts with the sample register, every situation on the dashboard", async () => {
    const { licenses, assets } = await services.loadLicenses();
    expect(assets.length).toBeGreaterThan(10);
    const statuses = new Set(licenses.map((license) => license.computed.status));
    for (const status of ["ACTIVE", "EXPIRING", "EXPIRED", "NO_EXPIRY", "NO_DATE"]) expect(statuses).toContain(status);
    expect(licenses.some((license) => license.computed.pendingRenewal)).toBe(true);
  });

  it("adds an asset and a license against it, with readable ids and an audit trail", async () => {
    const asset = await services.saveAsset(
      {
        name: "Ruwa Depot",
        type: "Depot",
        company: "Trade Kings",
        department: "Logistics",
        address: "Ruwa",
        city: "Ruwa",
        latitude: -17.89,
        longitude: 31.24,
        registration: "",
        responsibleName: "",
        responsibleEmail: "",
        notes: "",
      },
      "admin@tkzim.co.zw",
    );
    expect(asset.id).toBe("AS-018");

    const license = await services.saveLicense(
      {
        ...blankLicense,
        name: "Fire certificate — Ruwa",
        category: "Warehouses & Sites",
        type: "Fire certificate",
        assetId: asset.id,
        expiryDate: "2026-01-31",
        renewalFrequency: "Annual",
      },
      "admin@tkzim.co.zw",
    );
    expect(license.id).toBe("LIC-036");

    const profile = await services.getAssetProfile(asset.id);
    expect(profile?.licenses.map((item) => item.id)).toEqual([license.id]);
    expect(profile?.worstStatus).toBe("EXPIRED");
  });

  it("refuses a license pointing at an asset that does not exist", async () => {
    await expect(
      services.saveLicense(
        { ...blankLicense, name: "X", category: "Trucks & Vehicles", type: "Vehicle license", assetId: "AS-999", expiryDate: null, renewalFrequency: "Annual" },
        "admin@tkzim.co.zw",
      ),
    ).rejects.toThrow(/Choose an asset/);
  });

  it("records a renewal: history kept, new dates on the license, certificate filed by asset", async () => {
    await services.recordRenewal(
      { licenseId: "LIC-036", renewedOn: "2026-09-30", newIssueDate: "2026-10-01", newExpiry: "2027-09-30", newNumber: "FC-27-001", notes: "" },
      { name: "renewed.pdf", bytes: PDF },
      "nyasha@tkzim.co.zw",
    );

    const profile = await services.getLicenseProfile("LIC-036");
    expect(profile?.license).toMatchObject({
      expiryDate: "2027-09-30",
      number: "FC-27-001",
      renewalStatus: "Renewed",
      lastRenewalDate: "2026-09-30",
    });
    expect(profile?.renewals[0]).toMatchObject({ previousExpiry: "2026-01-31", newExpiry: "2027-09-30" });
    expect(profile?.renewals[0].documentId).toBe(profile?.documents[0].id);
    expect(profile?.activity.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(["Renewal recorded", "Document uploaded", "Added"]),
    );
    const renewal = profile?.activity.find((entry) => entry.action === "Renewal recorded");
    expect(renewal?.details).toContain("Expiry Date: 2026-01-31 → 2027-09-30");

    const folder = path.join(directory, "uploads", "Warehouses & Sites", "AS-018 – Ruwa Depot");
    const [file] = await readdir(folder);
    expect(file).toMatch(/^\d{4}-\d{2}-\d{2} \d{6} License certificate – Fire certificate — Ruwa – Renewed certificate FC-27-001 2026-10-01\.pdf$/);

    const preview = await services.readLicenseDocument(profile!.documents[0].id);
    expect(preview?.mimeType).toBe("application/pdf");
  });

  it("only serves documents recorded in the register", async () => {
    expect(await services.readLicenseDocument("nope")).toBeNull();
  });

  it("applies the reminder days an administrator sets", async () => {
    await services.saveReminderDays("120, 30", "admin@tkzim.co.zw");
    expect((await services.getLicenseRules()).reminderDays).toEqual([120, 30]);
    await services.saveReminderDays("", "admin@tkzim.co.zw");
    expect((await services.getLicenseRules()).reminderDays).toEqual([90, 60, 30, 7]);
  });

  it("exports the register as formula-safe CSV", async () => {
    const { licenses } = await services.loadLicenses();
    const csv = services.licensesToCsv(licenses);
    expect(csv.split("\n")[0]).toContain("License / Certificate Number");
    expect(csv.split("\n")).toHaveLength(licenses.length + 1);
  });
});
