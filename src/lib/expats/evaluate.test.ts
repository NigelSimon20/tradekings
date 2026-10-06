import { describe, expect, it } from "vitest";

import { buildSeedExpats } from "@/lib/expats/data/seed";
import { evaluateExpats, isHistoricalDocument, sortExpiries } from "@/lib/expats/evaluate";
import { filterExpiries, filterPeople, parseExpiryFilters, parsePeopleFilters } from "@/lib/expats/filters";
import { redactExpatData, keepSensitive } from "@/lib/expats/redact";
import { dueReminders, recipientsFor, reminderLogKey, renderReminderEmail } from "@/lib/expats/reminders";
import { parseRecipients } from "@/lib/expats/rules";
import type { Dependant, Expat, ExpatData, ExpatDocument, Lease, Permit } from "@/lib/expats/types";
import { EXPAT_TILES } from "@/lib/expats/views";

const TODAY = "2026-10-06";

const expat = (overrides: Partial<Expat> = {}): Expat => ({
  id: "EXP-001",
  fullName: "Rajesh Kumar",
  employeeNumber: "TK-E140",
  nationality: "Indian",
  dateOfBirth: "1979-04-12",
  phone: "+263 77 200 400",
  email: "rajesh@tradekings.co.zw",
  residentialAddress: "14 Glenara Avenue",
  emergencyName: "Priya Kumar",
  emergencyRelationship: "Spouse",
  emergencyPhone: "+263 71 300 100",
  company: "Trade Kings",
  department: "Production",
  position: "Factory Manager",
  managerName: "Farai Ncube",
  managerEmail: "farai@tradekings.co.zw",
  employmentStart: "2022-01-01",
  contractEnd: "2028-01-01",
  employmentStatus: "Active",
  notes: "",
  archived: false,
  departureDate: null,
  departureReason: "",
  permitClosure: "",
  propertyHandover: "",
  vehicleReturn: "",
  outstandingActions: "",
  offboardingNotes: "",
  lastUpdated: "",
  lastUpdatedBy: "",
  ...overrides,
});

const permit = (overrides: Partial<Permit> & Pick<Permit, "id" | "type">): Permit => ({
  expatId: "EXP-001",
  dependantId: "",
  number: "P123",
  issuedBy: "",
  issueDate: "2024-01-01",
  expiryDate: "2030-01-01",
  status: "Issued",
  reference: "",
  submittedOn: null,
  outstandingDocuments: "",
  replacesId: "",
  notes: "",
  lastUpdated: "",
  lastUpdatedBy: "",
  ...overrides,
});

const doc = (overrides: Partial<ExpatDocument> & Pick<ExpatDocument, "id" | "category">): ExpatDocument => ({
  expatId: "EXP-001",
  dependantId: "",
  recordId: "",
  title: "Scan",
  url: "https://drive.google.com/x",
  storedFileId: "",
  mimeType: "",
  expiryDate: null,
  historical: false,
  addedAt: "",
  addedBy: "",
  removed: false,
  ...overrides,
});

const lease = (overrides: Partial<Lease> = {}): Lease => ({
  id: "LSE-001",
  expatId: "EXP-001",
  address: "14 Glenara Avenue",
  landlordName: "Highlands Trust",
  landlordPhone: "024 2700",
  landlordEmail: "",
  startDate: "2026-01-01",
  expiryDate: "2027-06-30",
  monthlyRent: 1800,
  deposit: 3600,
  currency: "USD",
  noticeDate: null,
  status: "Active",
  notes: "",
  lastUpdated: "",
  lastUpdatedBy: "",
  ...overrides,
});

const spouse: Dependant = {
  id: "EXP-001-D1",
  expatId: "EXP-001",
  fullName: "Priya Kumar",
  relationship: "Spouse",
  dateOfBirth: "1982-09-03",
  nationality: "Indian",
  notes: "",
  archived: false,
  lastUpdated: "",
  lastUpdatedBy: "",
};

/** A profile with everything on file and in date. */
function complete(): ExpatData {
  return {
    expats: [expat()],
    dependants: [],
    permits: [permit({ id: "PER-001", type: "Passport" }), permit({ id: "PER-002", type: "Work permit", number: "TEP/1" })],
    leases: [],
    vehicles: [],
    actions: [],
    documents: [
      doc({ id: "D1", category: "Passport", recordId: "PER-001" }),
      doc({ id: "D2", category: "Visa / permit", recordId: "PER-002" }),
      doc({ id: "D3", category: "Employment contract" }),
    ],
    activity: [],
    reminders: [],
  };
}

const evaluateOne = (data: ExpatData) => evaluateExpats(data, { today: TODAY })[0];

describe("profile status", () => {
  it("is Complete when everything is on file and in date", () => {
    const row = evaluateOne(complete());
    expect(row.status).toBe("COMPLETE");
    expect(row.issues).toEqual([]);
  });

  it("is Missing documents without a passport, a permit, a contract or a scan", () => {
    const data = complete();
    data.permits = data.permits.filter((record) => record.type !== "Passport");
    data.documents = data.documents.filter((document) => document.category !== "Employment contract" && document.recordId !== "PER-002");
    const row = evaluateOne(data);
    expect(row.status).toBe("MISSING_DOCUMENTS");
    expect(row.issues.map((issue) => issue.text)).toEqual([
      "No passport recorded",
      "No copy of the work permit on file",
      "No employment contract on file",
    ]);
  });

  it("is Action required when something is inside a reminder window with no renewal started", () => {
    const data = complete();
    data.permits[1] = { ...data.permits[1], expiryDate: "2026-10-26" };
    const row = evaluateOne(data);
    expect(row.status).toBe("ACTION_REQUIRED");
    expect(row.issues[0].text).toBe("Work permit expires in 20 days (26 Oct 2026) — renewal not started");
    expect(row.expiries[0]).toMatchObject({ status: "EXPIRING", reminderDays: 30, needsAction: true });
  });

  it("is Action required for an overdue follow-up", () => {
    const data = complete();
    data.actions = [
      {
        id: "FUP-001",
        expatId: "EXP-001",
        title: "Chase Immigration",
        responsibleName: "",
        responsibleEmail: "",
        dueDate: "2026-10-01",
        status: "Open",
        notes: "",
        createdAt: "",
        createdBy: "",
        completedAt: "",
        lastUpdated: "",
        lastUpdatedBy: "",
      },
    ];
    const row = evaluateOne(data);
    expect(row.status).toBe("ACTION_REQUIRED");
    expect(row.overdueActions).toBe(1);
    expect(row.issues.map((issue) => issue.section)).toContain("actions");
  });

  it("needs a passport for every dependant in the household, but not for one who left", () => {
    const data = complete();
    data.dependants = [spouse];
    expect(evaluateOne(data).issues.map((issue) => issue.text)).toContain("No passport recorded for Priya Kumar");
    data.dependants = [{ ...spouse, archived: true }];
    expect(evaluateOne(data).status).toBe("COMPLETE");
  });

  it("an offboarded expat has no reminders or issues", () => {
    const data = complete();
    data.expats = [expat({ archived: true })];
    data.permits[0] = { ...data.permits[0], expiryDate: "2026-01-01" };
    const row = evaluateOne(data);
    expect(row.expiries).toEqual([]);
    expect(row.status).toBe("COMPLETE");
  });
});

describe("permits, applications and renewals", () => {
  it("a renewal under way stops an expiring permit being an action", () => {
    const data = complete();
    data.permits[1] = { ...data.permits[1], expiryDate: "2026-10-26" };
    data.permits.push(permit({ id: "PER-003", type: "Work permit", status: "Submitted", replacesId: "PER-002", expiryDate: null }));
    const row = evaluateOne(data);
    const current = row.permits.find((record) => record.id === "PER-002")!;
    expect(current.renewal?.id).toBe("PER-003");
    expect(current.expiry).toMatchObject({ renewalInProgress: true, needsAction: false });
    expect(row.applicationsInProgress).toBe(1);
    expect(row.status).toBe("COMPLETE");
  });

  it("once the renewal is issued the old permit becomes history and stops being watched", () => {
    const data = complete();
    data.permits.push(permit({ id: "PER-003", type: "Work permit", status: "Issued", replacesId: "PER-002", expiryDate: "2028-10-26" }));
    data.documents.push(doc({ id: "D4", category: "Visa / permit", recordId: "PER-003" }));
    const row = evaluateOne(data);
    const old = row.permits.find((record) => record.id === "PER-002")!;
    expect(old).toMatchObject({ historical: true, current: false, expiry: null });
    expect(row.expiries.some((item) => item.recordId === "PER-002")).toBe(false);
    expect(isHistoricalDocument(row, data.documents.find((document) => document.id === "D2")!)).toBe(true);
    expect(isHistoricalDocument(row, data.documents.find((document) => document.id === "D4")!)).toBe(false);
  });

  it("an application waiting for documents lists what is outstanding", () => {
    const data = complete();
    data.permits.push(
      permit({ id: "PER-003", type: "Visa", status: "Documents Required", outstandingDocuments: "Police clearance\n- Medical report", expiryDate: null }),
    );
    const row = evaluateOne(data);
    expect(row.permits.at(-1)!.outstanding).toEqual(["Police clearance", "Medical report"]);
    expect(row.status).toBe("MISSING_DOCUMENTS");
    expect(row.issues.at(-1)!.text).toBe("Visa application is waiting for: Police clearance, Medical report");
  });

  it("a refused application is history and does not count as holding a permit", () => {
    const data = complete();
    data.permits = [data.permits[0], permit({ id: "PER-009", type: "Work permit", status: "Refused" })];
    const row = evaluateOne(data);
    expect(row.permits[1]).toMatchObject({ historical: true, inProgress: false });
    expect(row.issues.map((issue) => issue.text)).toContain("No work or residence permit recorded");
  });
});

describe("dates watched", () => {
  it("covers the contract, leases, notice dates, vehicle licences and cover", () => {
    const data = complete();
    data.expats = [expat({ contractEnd: "2026-11-05" })];
    data.leases = [lease({ noticeDate: "2026-10-01" }), lease({ id: "LSE-000", status: "Ended", expiryDate: "2025-12-31" })];
    data.vehicles = [
      {
        id: "VEH-001",
        expatId: "EXP-001",
        description: "Hilux",
        registration: "AFC 7731",
        ownership: "Company-owned",
        licenceExpiry: "2026-10-01",
        insurer: "",
        policyNumber: "",
        insuranceExpiry: "2026-12-01",
        status: "In use",
        notes: "",
        lastUpdated: "",
        lastUpdatedBy: "",
      },
    ];
    data.documents.push(doc({ id: "D9", category: "Lease agreement", recordId: "LSE-001" }));
    const kinds = evaluateOne(data).expiries.map((item) => `${item.kind}:${item.status}`);
    expect(kinds).toEqual([
      "Lease notice / renewal date:EXPIRED",
      "Vehicle licence:EXPIRED",
      "Employment contract:EXPIRING",
      "Vehicle insurance:EXPIRING",
      "Lease:VALID",
      "Passport:VALID",
      "Work permit:VALID",
    ]);
  });

  it("a lease being renewed or given notice on is handled, not an action", () => {
    const data = complete();
    data.leases = [lease({ expiryDate: "2026-10-20", status: "Renewal in progress" })];
    data.documents.push(doc({ id: "D9", category: "Lease agreement", recordId: "LSE-001" }));
    const item = evaluateOne(data).expiries.find((entry) => entry.kind === "Lease")!;
    expect(item).toMatchObject({ status: "EXPIRING", renewalInProgress: true, needsAction: false });
  });

  it("puts a dependant's documents in their own group, named for them", () => {
    const data = complete();
    data.dependants = [spouse];
    data.permits.push(permit({ id: "PER-010", type: "Passport", dependantId: spouse.id, expiryDate: "2026-09-01" }));
    const item = evaluateOne(data).expiries[0];
    expect(item).toMatchObject({ group: "Dependant documents", personName: "Priya Kumar", status: "EXPIRED", section: "household" });
  });

  it("sorts expired first, then soonest", () => {
    const rows = evaluateExpats(buildSeedExpats(TODAY), { today: TODAY });
    const sorted = sortExpiries(rows.flatMap((row) => row.expiries));
    const firstValid = sorted.findIndex((item) => item.status === "VALID");
    expect(sorted.slice(0, firstValid).every((item) => item.status !== "VALID")).toBe(true);
    expect(sorted[0].status).toBe("EXPIRED");
  });
});

describe("the sample register", () => {
  const data = buildSeedExpats(TODAY);
  const people = evaluateExpats(data, { today: TODAY }).filter((row) => !row.expat.archived);

  it("shows every profile status and every dashboard tile", () => {
    const statuses = new Set(people.map((row) => row.status));
    expect(statuses).toEqual(new Set(["COMPLETE", "MISSING_DOCUMENTS", "ACTION_REQUIRED"]));
    const input = {
      people,
      expiries: people.flatMap((row) => row.expiries),
      actions: data.actions.filter((action) => people.some((row) => row.expat.id === action.expatId)),
      applications: people.flatMap((row) => row.permits.filter((record) => record.inProgress)),
      today: TODAY,
    };
    for (const tile of EXPAT_TILES) expect(tile.count(input), tile.id).toBeGreaterThan(0);
  });

  it("filters people by nationality, permit status and lease status", () => {
    const filters = (params: Record<string, string>) => filterPeople(people, parsePeopleFilters(params), TODAY);
    expect(filters({ nationality: "indian" }).map((row) => row.expat.fullName)).toEqual(["Rajesh Kumar", "Anil Mehta"]);
    expect(filters({ permitStatus: "expired" }).map((row) => row.expat.fullName)).toEqual(["James Whitfield"]);
    expect(filters({ permitStatus: "application" }).map((row) => row.expat.fullName)).toContain("Grace Wanjiru");
    expect(filters({ leaseStatus: "Notice given" }).map((row) => row.expat.fullName)).toEqual(["Thomas Becker"]);
    expect(filters({ q: "priya" }).map((row) => row.expat.fullName)).toEqual(["Rajesh Kumar"]);
  });

  it("filters the expiry view by person, type and date range", () => {
    const items = people.flatMap((row) => row.expiries);
    const filtered = filterExpiries(items, parseExpiryFilters({ kind: "Passport", within: "60" }), TODAY);
    expect(filtered.every((item) => item.kind === "Passport" && item.daysRemaining <= 60)).toBe(true);
    expect(filtered.map((item) => item.personName)).toEqual(expect.arrayContaining(["Mei Lin Chen", "Omar Hassan", "Sarah Whitfield"]));
  });
});

describe("sensitive details", () => {
  it("are blanked for someone who may not see them, and kept when they save", () => {
    const data = complete();
    data.leases = [lease()];
    const hidden = redactExpatData(data);
    expect(hidden.expats[0]).toMatchObject({ dateOfBirth: null, phone: "", residentialAddress: "", fullName: "Rajesh Kumar" });
    expect(hidden.permits[0].number).toBe("");
    expect(hidden.leases[0]).toMatchObject({ address: "", monthlyRent: null, expiryDate: "2027-06-30" });
    expect(hidden.documents[0].url).toBe("");
    // The original is untouched.
    expect(data.permits[0].number).toBe("P123");

    const edited = { ...hidden.expats[0], position: "Plant Director" };
    expect(keepSensitive("expats", data.expats[0], edited)).toMatchObject({
      position: "Plant Director",
      phone: "+263 77 200 400",
      dateOfBirth: "1979-04-12",
    });
  });

  it("still lets the engine work on redacted data", () => {
    const data = complete();
    data.permits[1] = { ...data.permits[1], expiryDate: "2026-10-26" };
    const row = evaluateOne(redactExpatData(data));
    expect(row.status).toBe("ACTION_REQUIRED");
    expect(row.expiries[0].reference).toBe("");
  });
});

describe("reminder emails", () => {
  const data = complete();
  data.permits[1] = { ...data.permits[1], expiryDate: "2026-10-26" };
  data.permits[0] = { ...data.permits[0], expiryDate: "2026-09-30" };
  const items = evaluateOne(data).expiries;

  it("are due once per window and once on expiry", () => {
    const due = dueReminders(items, []);
    expect(due.map((reminder) => [reminder.item.kind, reminder.window])).toEqual([
      ["Passport", 0],
      ["Work permit", 30],
    ]);
    const log = due.map((reminder, index) => ({ id: `R${index}`, key: reminder.logKey, window: reminder.window, sentAt: "", sentTo: "" }));
    expect(dueReminders(items, log)).toEqual([]);
  });

  it("are not repeated for a wider window, and start over after a renewal", () => {
    const permitItem = items.find((item) => item.kind === "Work permit")!;
    const sentAt7 = [{ id: "R", key: reminderLogKey(permitItem), window: 7, sentAt: "", sentTo: "" }];
    expect(dueReminders([permitItem], sentAt7)).toEqual([]);
    const renewed = { ...permitItem, expiryDate: "2028-10-26" };
    expect(dueReminders([renewed], sentAt7)).toHaveLength(1);
  });

  it("go to every HR recipient and to the expat's manager", () => {
    const byRecipient = recipientsFor(dueReminders(items, []), parseRecipients("hr@tk.co.zw; HR@tk.co.zw, nonsense"));
    expect([...byRecipient.keys()]).toEqual(["hr@tk.co.zw", "farai@tradekings.co.zw"]);
    expect(byRecipient.get("farai@tradekings.co.zw")).toHaveLength(2);
  });

  it("escape what came from the sheet", () => {
    const tricky = items.map((item) => ({ ...item, expatName: "<script>alert(1)</script>" }));
    const email = renderReminderEmail({ reminders: dueReminders(tricky, []), appUrl: "https://tk.example", today: TODAY });
    expect(email.html).not.toContain("<script>");
    expect(email.subject).toBe("Expat Tracker: 2 expiry reminders (1 expired) — 06 Oct 2026");
    expect(email.text).toContain("https://tk.example/expats/EXP-001#immigration");
  });
});
