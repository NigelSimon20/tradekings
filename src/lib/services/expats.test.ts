import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The services are server-only; in a test there is no client bundle to protect.
vi.mock("server-only", () => ({}));

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/email/mailer", () => ({
  getMailer: () => ({
    kind: "outbox",
    label: "test",
    send: async (email: { to: string; subject: string; text: string }) => void sent.push(email),
  }),
}));

/**
 * The Expat Tracker end to end through the real services, on the sample-data
 * setup: a new expat and household, a permit renewal that moves the old one
 * to history, a restricted editor who cannot wipe what they cannot see,
 * uploads filed by person, offboarding, reminder emails and the exports.
 */

let directory: string;
let services: typeof import("@/lib/services/expats");

const PDF = new TextEncoder().encode("%PDF-1.7\n% passport scan\n");
const ADMIN = { actor: "hr@tradekings.co.zw", restricted: false };
const ALL = { expatPermissions: ["viewExpats", "viewSensitive"] as never[] };
const READ_ONLY = { expatPermissions: ["viewExpats"] as never[] };

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "expats-"));
  process.env.LOCAL_EXPATS_FILE = path.join(directory, "expats.json");
  process.env.LOCAL_EXPATS_UPLOADS_DIR = path.join(directory, "uploads");
  delete process.env.GOOGLE_EXPATS_SHEET_ID;
  delete process.env.GOOGLE_EXPATS_DOCUMENTS_FOLDER_ID;
  services = await import("@/lib/services/expats");
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

const newExpat = {
  fullName: "Lerato Mokoena",
  employeeNumber: "TK-E900",
  nationality: "South African",
  dateOfBirth: "1991-02-03",
  phone: "+263 77 123 4567",
  email: "lerato@tradekings.co.zw",
  residentialAddress: "1 Test Road, Harare",
  emergencyName: "Thabo Mokoena",
  emergencyRelationship: "Brother",
  emergencyPhone: "+27 82 000 0000",
  company: "Trade Kings",
  department: "Finance",
  position: "Financial Controller",
  managerName: "Farai Ncube",
  managerEmail: "farai.ncube@tradekings.co.zw",
  employmentStart: "2026-09-01",
  contractEnd: "2028-08-31",
  employmentStatus: "Active" as const,
  notes: "",
};

const permitInput = {
  dependantId: "",
  number: "M1234567",
  issuedBy: "South Africa",
  issueDate: "2020-01-01",
  expiryDate: "2030-01-01",
  status: "Issued" as const,
  reference: "",
  submittedOn: null,
  outstandingDocuments: "",
  replacesId: "",
  notes: "",
};

describe("the expat tracker", () => {
  let expatId = "";

  it("starts with the sample register", async () => {
    const snapshot = await services.loadExpats(ALL);
    expect(snapshot.people.length).toBeGreaterThan(8);
    expect(snapshot.archived).toHaveLength(1);
    expect(snapshot.source.kind).toBe("local");
  });

  it("adds an expat with the next readable id and logs it", async () => {
    const expat = await services.saveExpat(newExpat, ADMIN);
    expatId = expat.id;
    expect(expat.id).toBe("EXP-013");
    const profile = await services.getExpatProfile(ALL, expat.id);
    expect(profile?.row.status).toBe("MISSING_DOCUMENTS");
    expect(profile?.activity[0]).toMatchObject({ action: "Added", by: "hr@tradekings.co.zw" });
  });

  it("adds a dependant and a permit for them, and refuses another household's records", async () => {
    const child = await services.saveDependant(
      { expatId, fullName: "Naledi Mokoena", relationship: "Child", dateOfBirth: "2019-05-05", nationality: "South African", notes: "" },
      ADMIN,
    );
    expect(child.id).toBe(`${expatId}-D1`);
    await services.savePermit({ ...permitInput, expatId, dependantId: child.id, type: "Passport", number: "C7654321" }, ADMIN);
    await expect(
      services.savePermit({ ...permitInput, expatId, dependantId: "EXP-001-D1", type: "Passport" }, ADMIN),
    ).rejects.toThrow("not part of this expat's household");
  });

  it("tracks a renewal: the old permit becomes history once the new one is issued", async () => {
    const current = await services.savePermit({ ...permitInput, expatId, type: "Work permit", expiryDate: "2026-10-20" }, ADMIN);
    const renewal = await services.savePermit(
      { ...permitInput, expatId, type: "Work permit", number: "", status: "Submitted", expiryDate: null, replacesId: current.id },
      ADMIN,
    );
    let row = (await services.getExpatProfile(ALL, expatId))!.row;
    expect(row.permits.find((permit) => permit.id === current.id)?.renewal?.id).toBe(renewal.id);
    expect(row.applicationsInProgress).toBe(1);

    await services.savePermit(
      { ...permitInput, expatId, type: "Work permit", number: "TEP/2026/1", expiryDate: "2028-10-20", replacesId: current.id },
      { ...ADMIN, existingId: renewal.id },
    );
    row = (await services.getExpatProfile(ALL, expatId))!.row;
    expect(row.permits.find((permit) => permit.id === current.id)).toMatchObject({ historical: true, expiry: null });
    expect(row.applicationsInProgress).toBe(0);
  });

  it("hides sensitive details from a read-only viewer, everywhere", async () => {
    const hidden = (await services.getExpatProfile(READ_ONLY, expatId))!;
    expect(hidden.snapshot.restricted).toBe(true);
    expect(hidden.row.expat).toMatchObject({ phone: "", dateOfBirth: null, fullName: "Lerato Mokoena" });
    expect(hidden.row.permits.every((permit) => permit.number === "")).toBe(true);
    // The activity log never carries sensitive values either.
    const log = JSON.stringify(hidden.activity);
    expect(log).not.toContain("M1234567");
  });

  it("keeps what a restricted editor cannot see when they save", async () => {
    await services.saveExpat(
      { ...newExpat, phone: "", dateOfBirth: null, email: "", position: "Head of Finance" },
      { actor: "viewer@tradekings.co.zw", restricted: true, existingId: expatId },
    );
    const { expat } = (await services.getExpatProfile(ALL, expatId))!.row;
    expect(expat).toMatchObject({ position: "Head of Finance", phone: "+263 77 123 4567", dateOfBirth: "1991-02-03" });
  });

  it("files an upload under the expat and dependant, and reads it back only if recorded", async () => {
    const { row } = (await services.getExpatProfile(ALL, expatId))!;
    const child = row.dependants[0];
    const passport = row.permits.find((permit) => permit.dependantId === child.id)!;
    const document = await services.uploadExpatDocument(
      { expatId, dependantId: child.id, recordId: passport.id, category: "Dependant document", title: "Passport bio page", expiryDate: null },
      { name: "scan.pdf", bytes: PDF },
      ADMIN.actor,
    );
    const folders = await readdir(path.join(directory, "uploads", `${expatId} – Lerato Mokoena`));
    expect(folders).toEqual(["Naledi Mokoena (Child)"]);
    expect((await services.readExpatDocument(document.id))?.mimeType).toBe("application/pdf");
    expect(await services.readExpatDocument("DOC-NOT-RECORDED")).toBeNull();

    await expect(
      services.uploadExpatDocument(
        { expatId, dependantId: "", recordId: "PER-001", category: "Passport", title: "", expiryDate: null },
        { name: "scan.pdf", bytes: PDF },
        ADMIN.actor,
      ),
    ).rejects.toThrow("this expat's own records");
  });

  it("never emails the made-up people on the sample register", async () => {
    const run = await services.runExpatReminders({ appUrl: "https://tk.example", actor: "test" });
    expect(run.sent).toBe(0);
    expect(run.failures[0]).toMatch(/sample data/);
    expect(sent).toEqual([]);
  });

  it("emails each due reminder once, to HR and the manager", async () => {
    await services.saveReminderSettings("90, 60, 30, 7", "hr@tradekings.co.zw", ADMIN.actor);
    const first = await services.runExpatReminders({ appUrl: "https://tk.example", actor: "test", allowSample: true });
    expect(first.sent).toBeGreaterThan(5);
    expect(first.failures).toEqual([]);
    expect(sent.map((email) => email.to)).toContain("hr@tradekings.co.zw");
    expect(sent.find((email) => email.to === "hr@tradekings.co.zw")?.text).toContain("https://tk.example/expats/");

    const again = await services.runExpatReminders({ appUrl: "https://tk.example", actor: "test", allowSample: true });
    expect(again).toMatchObject({ due: 0, sent: 0 });
  });

  it("offboards without deleting, and restores", async () => {
    await services.offboardExpat(
      expatId,
      {
        departureDate: "2026-12-31",
        departureReason: "Transferred to Lusaka",
        permitClosure: "Cancelled",
        propertyHandover: "",
        vehicleReturn: "",
        outstandingActions: "",
        offboardingNotes: "",
      },
      ADMIN.actor,
    );
    let snapshot = await services.loadExpats(ALL);
    expect(snapshot.people.some((row) => row.expat.id === expatId)).toBe(false);
    expect(snapshot.archived.find((row) => row.expat.id === expatId)?.expat.departureReason).toBe("Transferred to Lusaka");
    expect(snapshot.expiries.some((item) => item.expatId === expatId)).toBe(false);

    await services.restoreExpat(expatId, ADMIN.actor);
    snapshot = await services.loadExpats(ALL);
    expect(snapshot.people.some((row) => row.expat.id === expatId)).toBe(true);
  });

  it("exports to Excel without sensitive details for a restricted viewer", async () => {
    const snapshot = await services.loadExpats(READ_ONLY);
    const workbook = new TextDecoder().decode(services.peopleWorkbook(snapshot.people));
    expect(workbook.startsWith("PK")).toBe(true);
    expect(workbook).toContain("Lerato Mokoena");
    expect(workbook).not.toContain("+263 77 123 4567");
  });
});
