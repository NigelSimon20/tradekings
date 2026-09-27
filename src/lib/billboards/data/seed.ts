import type { Billboard, BillboardData, BillboardFile, Campaign, MaintenanceRecord } from "@/lib/billboards/types";
import { addDays, type ISODate } from "@/lib/date/dates";

/**
 * A sample billboard network for development and demos, dated relative to
 * today so it always shows every situation the dashboard reports on: expired
 * and expiring leases, sites under maintenance, overdue inspections, damaged
 * boards, campaigns left up and a site still missing its GPS position.
 */

interface SiteSeed {
  name: string;
  city: string;
  area: string;
  road: string;
  at: [number, number] | null;
  type: string;
  status: Billboard["status"];
  /** Lease expiry, in days from today. */
  expiresIn: number | null;
  condition: Billboard["siteCondition"];
  /** Next inspection, in days from today. */
  inspectIn: number;
  issues?: string;
  followUp?: string;
  noLeaseDocument?: boolean;
  /** Campaign on the board: [brand, campaign, started days ago, ends in days]. */
  campaign?: [string, string, number, number | null];
  /** A campaign that ended but was never recorded as removed. */
  staleCampaign?: boolean;
}

const SITES: SiteSeed[] = [
  { name: "Samora Machel / Julius Nyerere", city: "Harare", area: "CBD", road: "Samora Machel Avenue", at: [-17.8292, 31.0522], type: "Static billboard", status: "Active", expiresIn: 410, condition: "Good", inspectIn: 40, campaign: ["Boom", "Washing paste — Clean for less", 20, 70] },
  { name: "Borrowdale Road, Sam Levy's", city: "Harare", area: "Borrowdale", road: "Borrowdale Road", at: [-17.7605, 31.0895], type: "Digital / LED", status: "Active", expiresIn: 21, condition: "Good", inspectIn: 12, campaign: ["Trade Kings", "Corporate — Made in Zimbabwe", 45, 15] },
  { name: "Airport Road inbound", city: "Harare", area: "Airport", road: "Airport Road", at: [-17.9010, 31.1010], type: "Unipole", status: "Active", expiresIn: 75, condition: "Fair", inspectIn: 25, campaign: ["Boom", "Dishwash launch", 10, 50] },
  { name: "Seke Road, Chitungwiza turn-off", city: "Harare", area: "Hatfield", road: "Seke Road", at: [-17.9420, 31.0680], type: "Static billboard", status: "Under Maintenance", expiresIn: 230, condition: "Damaged", inspectIn: 5, issues: "Storm damage to the left face; structure leaning", campaign: undefined },
  { name: "Mbare Musika", city: "Harare", area: "Mbare", road: "Remembrance Drive", at: [-17.8560, 31.0390], type: "Wall wrap", status: "Active", expiresIn: -12, condition: "Fair", inspectIn: 30, followUp: "Landlord asking for a 15% increase", campaign: ["Boom", "Bar soap value pack", 60, 30] },
  { name: "Msasa, Mutare Road", city: "Harare", area: "Msasa", road: "Harare–Mutare Road", at: [-17.8400, 31.1200], type: "Unipole", status: "Active", expiresIn: 520, condition: "Good", inspectIn: -9, campaign: undefined, staleCampaign: true },
  { name: "Westgate, Lomagundi Road", city: "Harare", area: "Westgate", road: "Lomagundi Road", at: [-17.7780, 30.9830], type: "Static billboard", status: "Inactive", expiresIn: -60, condition: "Poor", inspectIn: -30, noLeaseDocument: true },
  { name: "Makoni Shopping Centre", city: "Chitungwiza", area: "Makoni", road: "Chitungwiza Road", at: [-18.0050, 31.0790], type: "Street pole", status: "Active", expiresIn: 150, condition: "Good", inspectIn: 60, campaign: ["Trade Kings", "Beverages range", 5, 85] },
  { name: "Joshua Nkomo St & 6th Ave", city: "Bulawayo", area: "CBD", road: "Joshua Mqabuko Nkomo Street", at: [-20.1480, 28.5830], type: "Static billboard", status: "Active", expiresIn: 28, condition: "Good", inspectIn: 18, campaign: ["Boom", "Washing paste — Clean for less", 30, 60] },
  { name: "Nketa Drive", city: "Bulawayo", area: "Nketa", road: "Nketa Drive", at: [-20.1850, 28.5300], type: "Rooftop", status: "Active", expiresIn: 300, condition: "Fair", inspectIn: 45, issues: "Two floodlights not working", campaign: ["Trade Kings", "Biscuits range", 14, 76] },
  { name: "Belmont Industrial", city: "Bulawayo", area: "Belmont", road: "Beitbridge Road", at: [-20.1700, 28.6000], type: "Unipole", status: "Under Maintenance", expiresIn: 88, condition: "Poor", inspectIn: 3, issues: "Repainting the structure" },
  { name: "Herbert Chitepo Street", city: "Mutare", area: "CBD", road: "Herbert Chitepo Street", at: [-18.9707, 32.6709], type: "Static billboard", status: "Active", expiresIn: 610, condition: "Good", inspectIn: 70, campaign: ["Boom", "Dishwash launch", 12, 48] },
  { name: "Christmas Pass", city: "Mutare", area: "Christmas Pass", road: "Harare–Mutare Road", at: [-18.9420, 32.6320], type: "Unipole", status: "Active", expiresIn: 55, condition: "Good", inspectIn: 20, campaign: ["Trade Kings", "Corporate — Made in Zimbabwe", 40, 20] },
  { name: "Robert Mugabe Way", city: "Gweru", area: "CBD", road: "Robert Mugabe Way", at: [-19.4510, 29.8170], type: "Static billboard", status: "Active", expiresIn: 200, condition: "Good", inspectIn: 35, campaign: ["Boom", "Bar soap value pack", 25, 65] },
  { name: "Kwekwe Main Road", city: "Kwekwe", area: "CBD", road: "Robert Mugabe Way", at: [-18.9280, 29.8150], type: "Street pole", status: "Active", expiresIn: 9, condition: "Fair", inspectIn: 15, campaign: ["Trade Kings", "Beverages range", 50, 40] },
  { name: "Masvingo Showgrounds", city: "Masvingo", area: "Rhodene", road: "Hellet Street", at: [-20.0740, 30.8320], type: "Static billboard", status: "Inactive", expiresIn: 120, condition: "Fair", inspectIn: 90 },
  { name: "Kadoma tollgate", city: "Kadoma", area: "Rimuka", road: "Harare–Bulawayo Road", at: [-18.3330, 29.9150], type: "Unipole", status: "Active", expiresIn: 330, condition: "Good", inspectIn: -2, campaign: ["Boom", "Washing paste — Clean for less", 3, 87] },
  { name: "Victoria Falls, Livingstone Way", city: "Victoria Falls", area: "Town", road: "Livingstone Way", at: [-17.9320, 25.8300], type: "Digital / LED", status: "Active", expiresIn: 700, condition: "Good", inspectIn: 50, campaign: ["Trade Kings", "Corporate — Made in Zimbabwe", 18, null] },
  { name: "Chinhoyi Caves Road", city: "Chinhoyi", area: "Orange Grove", road: "Harare–Chirundu Road", at: [-17.3620, 30.1990], type: "Static billboard", status: "Active", expiresIn: 160, condition: "Good", inspectIn: 55, campaign: ["Boom", "Dishwash launch", 8, 52] },
  { name: "Marondera, The Green", city: "Marondera", area: "CBD", road: "The Green", at: [-18.1850, 31.5520], type: "Street pole", status: "Active", expiresIn: 85, condition: "Good", inspectIn: 28, noLeaseDocument: true },
  { name: "Beitbridge border approach", city: "Beitbridge", area: "Dulivhadzimu", road: "Harare–Beitbridge Road", at: [-22.2170, 30.0000], type: "Unipole", status: "Active", expiresIn: 380, condition: "Good", inspectIn: 65, campaign: ["Trade Kings", "Biscuits range", 22, 68] },
  { name: "Norton, Harare–Bulawayo Road", city: "Norton", area: "Katanga", road: "Harare–Bulawayo Road", at: null, type: "Static billboard", status: "Active", expiresIn: 260, condition: "", inspectIn: 30, followUp: "Coordinates to be captured on the next visit" },
];

const OWNERS = ["City Council", "Private landlord", "Property trust", "Service station owner"];
const STAMP = "2026-01-01T08:00:00.000Z";

export function buildSeedBillboards(today: ISODate): BillboardData {
  const days = (offset: number) => addDays(today, offset);
  const billboards: Billboard[] = [];
  const campaigns: Campaign[] = [];
  const maintenance: MaintenanceRecord[] = [];
  const files: BillboardFile[] = [];

  SITES.forEach((site, position) => {
    const id = `BB-${String(position + 1).padStart(3, "0")}`;
    const owner = `${site.city} ${OWNERS[position % OWNERS.length]}`;
    const expiry = site.expiresIn === null ? null : days(site.expiresIn);

    billboards.push({
      id,
      name: site.name,
      address: `${site.road}, ${site.area}, ${site.city}`,
      city: site.city,
      area: site.area,
      road: site.road,
      latitude: site.at?.[0] ?? null,
      longitude: site.at?.[1] ?? null,
      type: site.type,
      dimensions: site.type === "Street pole" ? "1.2m x 1.8m" : site.type === "Unipole" ? "18m x 6m" : "12m x 4m",
      faces: site.type === "Wall wrap" ? 1 : 2,
      status: site.status,
      owner,
      leaseStart: expiry ? addDays(expiry, -730) : null,
      leaseExpiry: expiry,
      leaseCost: `USD ${(400 + position * 75).toLocaleString("en-US")} / month`,
      noticePeriodDays: position % 3 === 0 ? 90 : 60,
      renewalNotes: position % 4 === 0 ? "Two-year renewal option at the same rate." : "",
      leaseDocumentUrl: site.noLeaseDocument ? "" : `https://drive.google.com/file/d/sample-lease-${id}`,
      landlordName: `${owner} — Estates office`,
      landlordPhone: `+263 77 ${String(1000000 + position * 13579).slice(0, 7)}`,
      landlordEmail: `estates.${site.city.toLowerCase().replace(/\s+/g, "")}@example.com`,
      councilName: `${site.city} Town Planning`,
      councilPhone: "+263 24 2 700 000",
      councilEmail: `planning.${site.city.toLowerCase().replace(/\s+/g, "")}@example.com`,
      contractorName: position % 2 ? "Signage Services (Pvt) Ltd" : "Outdoor Structures Zimbabwe",
      contractorPhone: "+263 71 555 0100",
      contractorEmail: "jobs@example.com",
      responsibleName: position % 2 ? "Tendai Marufu" : "Nyasha Chikomo",
      responsibleEmail: position % 2 ? "tendai.marufu@example.com" : "nyasha.chikomo@example.com",
      siteCondition: site.condition,
      lastInspection: days(site.inspectIn - 90),
      nextInspection: days(site.inspectIn),
      maintenanceIssues: site.issues ?? "",
      maintenanceNotes: "",
      followUp: Boolean(site.followUp),
      followUpNote: site.followUp ?? "",
      notes: "",
      archived: false,
      lastUpdated: STAMP,
      lastUpdatedBy: "Sample data",
    });

    // An earlier campaign, removed on time — history the profile can show.
    campaigns.push({
      id: `${id}-C1`,
      billboardId: id,
      brand: "Boom",
      campaign: "Festive season",
      startDate: days(-240),
      endDate: days(-150),
      installedOn: days(-240),
      removedOn: days(-148),
      artworkUrl: "",
      notes: "",
      recordedAt: STAMP,
      recordedBy: "Sample data",
    });

    if (site.campaign) {
      const [brand, campaign, startedAgo, endsIn] = site.campaign;
      campaigns.push({
        id: `${id}-C2`,
        billboardId: id,
        brand,
        campaign,
        startDate: days(-startedAgo),
        endDate: endsIn === null ? null : days(endsIn),
        installedOn: days(-startedAgo),
        removedOn: null,
        artworkUrl: `https://drive.google.com/file/d/sample-artwork-${id}`,
        notes: "",
        recordedAt: STAMP,
        recordedBy: "Sample data",
      });
    }
    if (site.staleCampaign) {
      campaigns.push({
        id: `${id}-C3`,
        billboardId: id,
        brand: "Trade Kings",
        campaign: "Beverages range",
        startDate: days(-100),
        endDate: days(-14),
        installedOn: days(-100),
        removedOn: null,
        artworkUrl: "",
        notes: "Contractor to confirm removal.",
        recordedAt: STAMP,
        recordedBy: "Sample data",
      });
    }

    maintenance.push({
      id: `${id}-M1`,
      billboardId: id,
      date: days(site.inspectIn - 90),
      kind: "Inspection",
      condition: site.condition,
      description: site.issues ? `Inspected. ${site.issues}.` : "Routine inspection — structure and lighting checked.",
      photoUrl: "",
      nextInspection: days(site.inspectIn),
      recordedAt: STAMP,
      recordedBy: "Sample data",
    });

    files.push({
      id: `${id}-F1`,
      billboardId: id,
      category: "Site photo",
      title: "Site photo — front view",
      url: `https://drive.google.com/file/d/sample-photo-${id}`,
      documentDate: days(site.inspectIn - 90),
      addedAt: STAMP,
      addedBy: "Sample data",
      removed: false,
    });
    if (position % 3 === 0) {
      files.push({
        id: `${id}-F2`,
        billboardId: id,
        category: "Council approval",
        title: "Council approval letter",
        url: `https://drive.google.com/file/d/sample-approval-${id}`,
        documentDate: expiry ? addDays(expiry, -740) : null,
        addedAt: STAMP,
        addedBy: "Sample data",
        removed: false,
      });
    }
  });

  return { billboards, campaigns, maintenance, files, activity: [] };
}
