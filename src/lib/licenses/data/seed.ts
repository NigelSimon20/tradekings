import type {
  Asset,
  License,
  LicenseData,
  LicenseDocument,
  RenewalStatus,
  Renewal,
} from "@/lib/licenses/types";
import { addDays, addMonths, type ISODate } from "@/lib/date/dates";

/**
 * A sample license register for development and demos, dated relative to
 * today so it always shows every situation the dashboard reports on: active,
 * inside each reminder window, expired and overdue, renewals with the
 * authority, a one-off permit, and a few gaps for someone to fix.
 */

const STAMP = "2026-01-01T08:00:00.000Z";
const BY = "Sample data";

type AssetSeed = [name: string, type: string, city: string, at: [number, number] | null, registration?: string];

const ASSETS: AssetSeed[] = [
  ["Msasa Warehouse", "Warehouse", "Harare", [-17.8402, 31.1189]],
  ["Workington Factory", "Factory", "Harare", [-17.8613, 31.0137]],
  ["Graniteside Depot", "Depot", "Harare", [-17.8483, 31.0466]],
  ["Belmont Warehouse", "Warehouse", "Bulawayo", [-20.1722, 28.5973]],
  ["Kelvin North Factory", "Factory", "Bulawayo", [-20.1265, 28.5726]],
  ["Mutare Depot", "Depot", "Mutare", [-18.9781, 32.6461]],
  ["Gweru Distribution Site", "Operational site", "Gweru", [-19.4637, 29.8235]],
  ["Masvingo Depot", "Depot", "Masvingo", [-20.0745, 30.8205]],
  ["Head Office", "Office", "Harare", [-17.8125, 31.0497]],
  ["Truck 01 — Scania R460", "Truck", "Harare", null, "AEZ 4471"],
  ["Truck 07 — Mercedes Actros", "Truck", "Bulawayo", null, "AFB 2290"],
  ["Truck 14 — Volvo FH", "Truck", "Harare", null, "AEX 8812"],
  ["Delivery van 03 — Toyota Hiace", "Vehicle", "Mutare", null, "ADT 5530"],
  ["Sales car 11 — Toyota Corolla", "Vehicle", "Harare", null, "AGA 1187"],
  ["Forklift FL-02", "Equipment", "Harare", null, "FL-02"],
  ["Steam boiler — Workington", "Equipment", "Harare", null, "BLR-01"],
  ["Trade Kings Zimbabwe (Pvt) Ltd", "Company-wide", "Harare", null],
];

/** [asset index, name, category, type, authority, expiry in days (null = none), frequency, status, department] */
type LicenseSeed = [number, string, string, string, string, number | null, string, RenewalStatus, string];

const SITES = "Warehouses & Sites";
const FLEET = "Trucks & Vehicles";
const EQUIPMENT = "Equipment & Other Assets";
const COMPANY = "Company & Operational";

const LICENSES: LicenseSeed[] = [
  [0, "Warehouse operating permit", SITES, "Warehouse permit", "City of Harare", 240, "Annual", "Not started", "Logistics"],
  [0, "Fire certificate", SITES, "Fire certificate", "Harare Fire Brigade", 25, "Annual", "Not started", "Logistics"],
  [0, "Health & safety certificate", SITES, "Health and safety certificate", "NSSA", 80, "Annual", "In progress", "SHEQ"],
  [1, "Factory registration", SITES, "Site license", "Ministry of Industry", 400, "Every 2 years", "Not started", "Production"],
  [1, "Fire certificate", SITES, "Fire certificate", "Harare Fire Brigade", -20, "Annual", "Not started", "Production"],
  [1, "Effluent discharge license", SITES, "Site compliance document", "EMA", 55, "Annual", "Not started", "SHEQ"],
  [1, "Occupancy certificate", SITES, "Occupancy certificate", "City of Harare", null, "One-off (no expiry)", "Not started", "Facilities"],
  [2, "Depot operating permit", SITES, "Warehouse permit", "City of Harare", 150, "Annual", "Not started", "Logistics"],
  [2, "Fire certificate", SITES, "Fire certificate", "Harare Fire Brigade", 6, "Annual", "Submitted to authority", "Logistics"],
  [3, "Warehouse operating permit", SITES, "Warehouse permit", "City of Bulawayo", 310, "Annual", "Not started", "Logistics"],
  [3, "Fire certificate", SITES, "Fire certificate", "Bulawayo Fire Brigade", 85, "Annual", "Not started", "Logistics"],
  [4, "Factory registration", SITES, "Site license", "Ministry of Industry", 190, "Every 2 years", "Not started", "Production"],
  [4, "Health & safety certificate", SITES, "Health and safety certificate", "NSSA", -45, "Annual", "Not started", "SHEQ"],
  [5, "Depot operating permit", SITES, "Warehouse permit", "City of Mutare", 120, "Annual", "Not started", "Logistics"],
  [5, "Fire certificate", SITES, "Fire certificate", "Mutare Fire Brigade", null, "Annual", "Not started", "Logistics"],
  [6, "Site license", SITES, "Site license", "City of Gweru", 60, "Annual", "Not started", "Logistics"],
  [7, "Depot operating permit", SITES, "Warehouse permit", "City of Masvingo", 205, "Annual", "Not started", "Logistics"],
  [8, "Shop & office license", SITES, "Site license", "City of Harare", 330, "Annual", "Not started", "Admin"],
  [9, "Vehicle license", FLEET, "Vehicle license", "ZINARA", 45, "Every 3 months", "Not started", "Fleet"],
  [9, "Roadworthiness certificate", FLEET, "Roadworthiness certificate", "VID", 160, "Every 6 months", "Not started", "Fleet"],
  [9, "Goods vehicle operator permit", FLEET, "Operating permit", "Ministry of Transport", 280, "Annual", "Not started", "Fleet"],
  [10, "Vehicle license", FLEET, "Vehicle license", "ZINARA", -5, "Every 3 months", "In progress", "Fleet"],
  [10, "Roadworthiness certificate", FLEET, "Roadworthiness certificate", "VID", 28, "Every 6 months", "Not started", "Fleet"],
  [11, "Vehicle license", FLEET, "Vehicle license", "ZINARA", 70, "Every 3 months", "Not started", "Fleet"],
  [11, "Roadworthiness certificate", FLEET, "Roadworthiness certificate", "VID", -12, "Every 6 months", "Not started", "Fleet"],
  [12, "Vehicle license", FLEET, "Vehicle license", "ZINARA", 15, "Every 3 months", "Not started", "Sales"],
  [13, "Vehicle license", FLEET, "Vehicle license", "ZINARA", 100, "Every 3 months", "Not started", "Sales"],
  [13, "Vehicle insurance", FLEET, "Vehicle insurance", "Insurer", 230, "Annual", "Not started", "Sales"],
  [14, "Forklift inspection certificate", EQUIPMENT, "Inspection certificate", "NSSA", 40, "Annual", "Not started", "Logistics"],
  [15, "Boiler inspection certificate", EQUIPMENT, "Inspection certificate", "NSSA", 4, "Annual", "Not started", "Production"],
  [15, "Pressure vessel permit", EQUIPMENT, "Permit", "Ministry of Labour", 500, "Every 2 years", "Not started", "Production"],
  [16, "Company registration", COMPANY, "Company license", "Registrar of Companies", null, "One-off (no expiry)", "Not started", "Legal"],
  [16, "Tax clearance (ITF263)", COMPANY, "Regulatory permit", "ZIMRA", 75, "Annual", "Not started", "Finance"],
  [16, "Manufacturing license", COMPANY, "Operational license", "Ministry of Industry", 360, "Annual", "Not started", "Legal"],
  [16, "Import license", COMPANY, "Operational license", "Ministry of Industry", -60, "Annual", "Not renewing", "Procurement"],
];

const FREQUENCY_MONTHS_FOR_SEED: Record<string, number> = {
  Annual: 12,
  "Every 6 months": 6,
  "Every 3 months": 3,
  "Every 2 years": 24,
};

export function buildSeedLicenses(today: ISODate): LicenseData {
  const days = (offset: number) => addDays(today, offset);

  const assets: Asset[] = ASSETS.map(([name, type, city, at, registration], position) => ({
    id: `AS-${String(position + 1).padStart(3, "0")}`,
    name,
    type,
    company: name.startsWith("Trade Kings") || position % 4 ? "Trade Kings" : "ZimKings",
    department: type === "Truck" || type === "Vehicle" ? "Fleet" : type === "Factory" ? "Production" : "Logistics",
    address: at ? `${name}, ${city}` : "",
    city,
    latitude: at?.[0] ?? null,
    longitude: at?.[1] ?? null,
    registration: registration ?? "",
    responsibleName: position % 3 ? "Nyasha Chikomo" : "Tendai Marufu",
    responsibleEmail: position % 3 ? "nyasha.chikomo@example.com" : "tendai.marufu@example.com",
    notes: "",
    archived: false,
    lastUpdated: STAMP,
    lastUpdatedBy: BY,
  }));

  const licenses: License[] = [];
  const renewals: Renewal[] = [];
  const documents: LicenseDocument[] = [];

  LICENSES.forEach(([assetIndex, name, category, type, authority, expiresIn, frequency, status, department], position) => {
    const id = `LIC-${String(position + 1).padStart(3, "0")}`;
    const asset = assets[assetIndex];
    const expiry = expiresIn === null ? null : days(expiresIn);
    const months = FREQUENCY_MONTHS_FOR_SEED[frequency] ?? 12;
    const issue = expiry ? addDays(addMonths(expiry, -months), 1) : days(-900);

    licenses.push({
      id,
      name: `${name} — ${asset.name.split(" — ")[0]}`,
      category,
      type,
      number: `${type.split(" ").map((word) => word[0]).join("").toUpperCase()}-${2026 - (position % 3)}-${String(1000 + position * 37).slice(-4)}`,
      assetId: asset.id,
      issuingAuthority: authority,
      issueDate: issue,
      expiryDate: expiry,
      renewalFrequency: frequency,
      renewalStatus: status,
      department,
      // A couple are left without an owner, for the dashboard to point out.
      responsibleName: position % 11 === 5 ? "" : asset.responsibleName,
      responsibleEmail: position % 11 === 5 ? "" : asset.responsibleEmail,
      contactName: `${authority} licensing desk`,
      contactPhone: "+263 24 2 700 000",
      contactEmail: "licensing@example.com",
      conditions: position % 5 === 0 ? "Display the certificate at the main entrance." : "",
      lastRenewalDate: expiry && position % 2 === 0 ? issue : null,
      archived: false,
      lastUpdated: STAMP,
      lastUpdatedBy: BY,
    });

    // Every other license has its certificate on file and a previous renewal.
    if (position % 2 === 0) {
      documents.push({
        id: `${id}-D1`,
        licenseId: id,
        assetId: asset.id,
        category: "License / certificate",
        title: `${name} certificate`,
        url: `https://drive.google.com/file/d/sample-license-${id}`,
        storedFileId: "",
        mimeType: "",
        documentDate: issue,
        addedAt: STAMP,
        addedBy: BY,
        removed: false,
      });
      if (expiry) {
        renewals.push({
          id: `${id}-R1`,
          licenseId: id,
          renewedOn: addDays(issue, -10),
          previousExpiry: addDays(issue, -1),
          newIssueDate: issue,
          newExpiry: expiry,
          newNumber: "",
          documentId: `${id}-D1`,
          notes: "Renewed on time.",
          recordedAt: STAMP,
          recordedBy: BY,
        });
      }
    }
  });

  return { assets, licenses, renewals, documents, activity: [] };
}
