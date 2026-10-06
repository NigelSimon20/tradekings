import { addDays, type ISODate } from "@/lib/date/dates";
import type {
  ApplicationStatus,
  Dependant,
  DocumentCategory,
  Expat,
  ExpatData,
  ExpatDocument,
  FollowUp,
  Lease,
  LeaseStatus,
  Permit,
  Vehicle,
} from "@/lib/expats/types";

/**
 * A sample expat register for development, demos and training, dated relative
 * to today so it always shows every situation the dashboard reports on:
 * complete profiles, permits in each reminder window, expired documents,
 * applications at every stage, renewals under way, leases and vehicles
 * coming up, overdue follow-ups, gaps to fix and one offboarded expat.
 */

const STAMP = "2026-01-01T08:00:00.000Z";
const BY = "Sample data";

interface PersonSeed {
  name: string;
  nationality: string;
  born: string;
  company: "Trade Kings" | "ZimKings";
  department: string;
  position: string;
  manager: [string, string];
  /** Days from today: when they started, and when the contract ends. */
  started: number;
  contractEnds: number | null;
  status?: Expat["employmentStatus"];
  /** Days from today each document expires; null leaves it out. */
  passport: number | null;
  permit: { type: string; expires: number } | null;
  /** On file: a scan of every current document and the contract. */
  filed: boolean;
  dependants?: { name: string; relationship: string; born: string; passport: number | null }[];
  lease?: { address: string; landlord: string; expires: number; rent: number; status?: LeaseStatus; noticeDays?: number };
  vehicle?: { description: string; registration: string; ownership: string; licence: number; insurance: number };
  application?: { type: string; status: ApplicationStatus; renews: boolean; outstanding?: string; dependant?: number };
  actions?: { title: string; due: number; status?: FollowUp["status"]; who?: [string, string] }[];
  archived?: { left: number; reason: string };
}

const HR: [string, string] = ["Tendai Moyo", "tendai.moyo@example.com"];

const PEOPLE: PersonSeed[] = [
  {
    name: "Rajesh Kumar",
    nationality: "Indian",
    born: "1979-04-12",
    company: "Trade Kings",
    department: "Production",
    position: "Factory Manager",
    manager: ["Farai Ncube", "farai.ncube@example.com"],
    started: -1500,
    contractEnds: 410,
    passport: 1300,
    permit: { type: "Temporary employment permit", expires: 240 },
    filed: true,
    dependants: [
      { name: "Priya Kumar", relationship: "Spouse", born: "1982-09-03", passport: 1100 },
      { name: "Arjun Kumar", relationship: "Child", born: "2012-02-17", passport: 700 },
    ],
    lease: { address: "14 Glenara Avenue, Highlands, Harare", landlord: "Highlands Property Trust", expires: 300, rent: 1800, noticeDays: 210 },
    vehicle: { description: "Toyota Fortuner", registration: "AFK 2210", ownership: "Company-owned", licence: 150, insurance: 190 },
  },
  {
    name: "Pieter van der Merwe",
    nationality: "South African",
    born: "1975-11-30",
    company: "Trade Kings",
    department: "Engineering",
    position: "Chief Engineer",
    manager: ["Farai Ncube", "farai.ncube@example.com"],
    started: -2400,
    contractEnds: 120,
    passport: 800,
    permit: { type: "Temporary employment permit", expires: 22 },
    filed: true,
    dependants: [{ name: "Anja van der Merwe", relationship: "Spouse", born: "1978-06-21", passport: 1500 }],
    lease: { address: "3 Kew Drive, Mandara, Harare", landlord: "Mrs R. Chikore", expires: 75, rent: 1500 },
    vehicle: { description: "Ford Ranger", registration: "AEY 9014", ownership: "Company-owned", licence: 18, insurance: 210 },
    application: { type: "Temporary employment permit", status: "Submitted", renews: true },
  },
  {
    name: "Mei Lin Chen",
    nationality: "Chinese",
    born: "1986-01-08",
    company: "Trade Kings",
    department: "Quality",
    position: "Quality Assurance Lead",
    manager: ["Chipo Dube", "chipo.dube@example.com"],
    started: -700,
    contractEnds: 365,
    passport: 55,
    permit: { type: "Temporary employment permit", expires: 330 },
    filed: true,
    lease: { address: "Flat 6, Fairbridge Court, Avondale, Harare", landlord: "Avondale Lettings", expires: 160, rent: 950 },
    actions: [{ title: "Book Chinese embassy appointment for passport renewal", due: 10, who: HR }],
  },
  {
    name: "James Whitfield",
    nationality: "British",
    born: "1969-07-22",
    company: "ZimKings",
    department: "Finance",
    position: "Finance Director",
    manager: ["Board — ZimKings", "board@example.com"],
    started: -3100,
    contractEnds: 640,
    passport: 2100,
    permit: { type: "Residence permit", expires: -12 },
    filed: true,
    dependants: [{ name: "Sarah Whitfield", relationship: "Spouse", born: "1971-03-14", passport: -40 }],
    lease: { address: "22 Lomagundi Road, Mount Pleasant, Harare", landlord: "Pleasant Homes (Pvt) Ltd", expires: 500, rent: 2400 },
    vehicle: { description: "Land Cruiser Prado", registration: "ADZ 1188", ownership: "Leased", licence: -5, insurance: 40 },
    actions: [
      { title: "Chase Immigration for residence permit renewal outcome", due: -6, who: HR },
      { title: "Renew Sarah Whitfield's passport at the British Embassy", due: -2, who: HR },
    ],
  },
  {
    name: "Grace Wanjiru",
    nationality: "Kenyan",
    born: "1990-05-05",
    company: "Trade Kings",
    department: "Marketing",
    position: "Brand Manager",
    manager: ["Chipo Dube", "chipo.dube@example.com"],
    started: -60,
    contractEnds: 670,
    passport: 1800,
    permit: null,
    filed: false,
    application: {
      type: "Temporary employment permit",
      status: "Documents Required",
      renews: false,
      outstanding: "Police clearance from Kenya\nCertified degree certificate\nMedical report",
    },
    actions: [{ title: "Collect police clearance certificate from Grace", due: 5, who: HR }],
  },
  {
    name: "Ahmed Hassan",
    nationality: "Egyptian",
    born: "1983-12-01",
    company: "Trade Kings",
    department: "Logistics",
    position: "Supply Chain Manager",
    manager: ["Tafadzwa Mutasa", "tafadzwa.mutasa@example.com"],
    started: -900,
    contractEnds: 85,
    passport: 1400,
    permit: { type: "Temporary employment permit", expires: 85 },
    filed: true,
    dependants: [
      { name: "Nour Hassan", relationship: "Spouse", born: "1987-08-19", passport: 900 },
      { name: "Omar Hassan", relationship: "Child", born: "2016-04-02", passport: 6 },
      { name: "Layla Hassan", relationship: "Child", born: "2019-10-11", passport: 950 },
    ],
    lease: { address: "9 Sandringham Drive, Alexandra Park, Harare", landlord: "Mr T. Gumbo", expires: 28, rent: 1600, status: "Renewal in progress" },
    application: { type: "Passport", status: "Ready for Submission", renews: true, dependant: 1 },
  },
  {
    name: "Carlos Mendes",
    nationality: "Portuguese",
    born: "1981-02-26",
    company: "ZimKings",
    department: "Sales",
    position: "Regional Sales Manager",
    manager: ["Board — ZimKings", "board@example.com"],
    started: -1200,
    contractEnds: 300,
    passport: 1000,
    permit: { type: "Temporary employment permit", expires: 140 },
    filed: false,
    vehicle: { description: "Toyota Hilux", registration: "AFC 7731", ownership: "Company-owned", licence: 70, insurance: 8 },
  },
  {
    name: "Fatima Al-Sayed",
    nationality: "Lebanese",
    born: "1988-09-15",
    company: "Trade Kings",
    department: "Human Resources",
    position: "Regional HR Business Partner",
    manager: HR,
    started: -400,
    contractEnds: 700,
    passport: 1200,
    permit: { type: "Temporary employment permit", expires: 500 },
    filed: true,
    lease: { address: "5 Bishop Gaul Avenue, Belgravia, Harare", landlord: "Belgravia Estates", expires: 420, rent: 1100 },
  },
  {
    name: "Samuel Okafor",
    nationality: "Nigerian",
    born: "1977-03-03",
    company: "Trade Kings",
    department: "Production",
    position: "Maintenance Manager",
    manager: ["Farai Ncube", "farai.ncube@example.com"],
    started: -1800,
    contractEnds: 45,
    passport: 600,
    permit: { type: "Temporary employment permit", expires: 45 },
    filed: true,
    application: { type: "Temporary employment permit", status: "In Progress", renews: true },
    lease: { address: "18 Ridgeway North, Highlands, Harare", landlord: "Ridgeway Holdings", expires: 200, rent: 1300 },
    actions: [{ title: "Confirm contract extension with Production director", due: 14, who: ["Farai Ncube", "farai.ncube@example.com"] }],
  },
  {
    name: "Anil Mehta",
    nationality: "Indian",
    born: "1984-06-18",
    company: "Trade Kings",
    department: "IT",
    position: "Systems Lead",
    manager: ["Chipo Dube", "chipo.dube@example.com"],
    started: -500,
    contractEnds: 230,
    status: "On leave",
    passport: 1600,
    permit: { type: "Temporary employment permit", expires: 260 },
    filed: true,
    dependants: [{ name: "Kavya Mehta", relationship: "Spouse", born: "1986-12-09", passport: 1700 }],
    lease: { address: "Unit 2, Borrowdale Brooke Estate, Harare", landlord: "Brooke Residential", expires: 340, rent: 1450 },
    application: { type: "Visa", status: "Approved", renews: false, dependant: 0 },
  },
  {
    name: "Thomas Becker",
    nationality: "German",
    born: "1972-10-10",
    company: "Trade Kings",
    department: "Engineering",
    position: "Project Engineer (Plant expansion)",
    manager: ["Farai Ncube", "farai.ncube@example.com"],
    started: -300,
    contractEnds: 25,
    status: "Notice period",
    passport: 1900,
    permit: { type: "Temporary employment permit", expires: 25 },
    filed: true,
    lease: { address: "41 Harare Drive, Marlborough, Harare", landlord: "Mrs P. Sibanda", expires: 30, rent: 1000, status: "Notice given" },
    actions: [
      { title: "Arrange permit cancellation with Immigration on departure", due: 24, who: HR },
      { title: "Agree property handover date with landlord", due: 20, status: "In progress", who: HR },
    ],
  },
  {
    name: "Maria Santos",
    nationality: "Filipino",
    born: "1985-01-29",
    company: "ZimKings",
    department: "Quality",
    position: "Laboratory Supervisor",
    manager: ["Board — ZimKings", "board@example.com"],
    started: -2600,
    contractEnds: null,
    status: "Inactive",
    passport: 300,
    permit: { type: "Temporary employment permit", expires: -200 },
    filed: true,
    archived: { left: -180, reason: "Contract ended — returned to the Philippines" },
  },
];

const pad = (value: number) => String(value).padStart(3, "0");

export function buildSeedExpats(today: ISODate): ExpatData {
  const day = (offset: number) => addDays(today, offset);
  const expats: Expat[] = [];
  const dependants: Dependant[] = [];
  const permits: Permit[] = [];
  const leases: Lease[] = [];
  const vehicles: Vehicle[] = [];
  const actions: FollowUp[] = [];
  const documents: ExpatDocument[] = [];
  const stamp = { lastUpdated: STAMP, lastUpdatedBy: BY };
  let permitNo = 0;
  let documentNo = 0;
  let actionNo = 0;

  const file = (expatId: string, category: DocumentCategory, title: string, extra: Partial<ExpatDocument> = {}) => {
    documentNo += 1;
    documents.push({
      id: `DOC-${pad(documentNo)}`,
      expatId,
      dependantId: "",
      recordId: "",
      category,
      title,
      url: `https://drive.google.com/file/d/sample-expat-doc-${documentNo}`,
      storedFileId: "",
      mimeType: "",
      expiryDate: null,
      historical: false,
      addedAt: STAMP,
      addedBy: BY,
      removed: false,
      ...extra,
    });
  };

  const permit = (fields: Partial<Permit> & Pick<Permit, "expatId" | "type" | "status">): Permit => {
    permitNo += 1;
    const record: Permit = {
      id: `PER-${pad(permitNo)}`,
      dependantId: "",
      number: "",
      issuedBy: "",
      issueDate: null,
      expiryDate: null,
      reference: "",
      submittedOn: null,
      outstandingDocuments: "",
      replacesId: "",
      notes: "",
      ...stamp,
      ...fields,
    };
    permits.push(record);
    return record;
  };

  PEOPLE.forEach((person, position) => {
    const id = `EXP-${pad(position + 1)}`;
    const [first] = person.name.split(" ");
    const handle = person.name.toLowerCase().replace(/[^a-z]+/g, ".");
    const domain = person.company === "ZimKings" ? "example.com" : "example.com";
    expats.push({
      id,
      fullName: person.name,
      employeeNumber: `${person.company === "ZimKings" ? "ZK" : "TK"}-E${pad(140 + position * 7)}`,
      nationality: person.nationality,
      dateOfBirth: person.born,
      phone: `+263 77 ${pad(200 + position * 13)} ${pad(400 + position * 29)}`,
      email: `${handle}@${domain}`,
      residentialAddress: person.lease?.address ?? "",
      emergencyName: person.dependants?.[0]?.name ?? `${first}'s family contact`,
      emergencyRelationship: person.dependants?.[0]?.relationship ?? "Sibling",
      emergencyPhone: `+263 71 ${pad(300 + position * 17)} ${pad(100 + position * 31)}`,
      company: person.company,
      department: person.department,
      position: person.position,
      managerName: person.manager[0],
      managerEmail: person.manager[1],
      employmentStart: day(person.started),
      contractEnd: person.contractEnds === null ? null : day(person.contractEnds),
      employmentStatus: person.status ?? "Active",
      notes: "",
      archived: Boolean(person.archived),
      departureDate: person.archived ? day(person.archived.left) : null,
      departureReason: person.archived?.reason ?? "",
      permitClosure: person.archived ? "Permit cancelled with the Department of Immigration on departure." : "",
      propertyHandover: person.archived ? "Company flat handed back; keys returned to Facilities." : "",
      vehicleReturn: person.archived ? "No company vehicle." : "",
      outstandingActions: person.archived ? "None." : "",
      offboardingNotes: person.archived ? "Final pay and gratuity settled. Eligible for re-engagement." : "",
      ...stamp,
    });

    if (person.filed) {
      file(id, "Employment contract", `Employment contract — ${person.name}`);
      file(id, "CV", `CV — ${person.name}`);
    }

    const passport =
      person.passport === null
        ? null
        : permit({
            expatId: id,
            type: "Passport",
            status: "Issued",
            number: `${person.nationality.slice(0, 1)}${pad(4000 + position * 37)}${pad(100 + position)}`,
            issuedBy: `${person.nationality} government`,
            issueDate: day(person.passport - 3650),
            expiryDate: day(person.passport),
          });
    if (passport && person.filed) file(id, "Passport", "Passport — bio page", { recordId: passport.id });

    const workPermit = person.permit
      ? permit({
          expatId: id,
          type: person.permit.type,
          status: "Issued",
          number: `TEP/${2024 + (position % 2)}/${pad(1200 + position * 41)}`,
          issuedBy: "Department of Immigration Zimbabwe",
          issueDate: day(person.permit.expires - 730),
          expiryDate: day(person.permit.expires),
        })
      : null;
    if (workPermit && person.filed) file(id, "Visa / permit", workPermit.type, { recordId: workPermit.id });

    const household = (person.dependants ?? []).map((seed, index) => {
      const dependant: Dependant = {
        id: `${id}-D${index + 1}`,
        expatId: id,
        fullName: seed.name,
        relationship: seed.relationship,
        dateOfBirth: seed.born,
        nationality: person.nationality,
        notes: seed.relationship === "Child" ? "Attends school in Harare." : "",
        archived: false,
        ...stamp,
      };
      dependants.push(dependant);
      if (seed.passport !== null) {
        const record = permit({
          expatId: id,
          dependantId: dependant.id,
          type: "Passport",
          status: "Issued",
          number: `${person.nationality.slice(0, 1)}${pad(7000 + position * 53 + index)}${pad(index + 10)}`,
          issuedBy: `${person.nationality} government`,
          issueDate: day(seed.passport - 3650),
          expiryDate: day(seed.passport),
        });
        file(id, "Dependant document", `Passport — ${seed.name}`, { dependantId: dependant.id, recordId: record.id });
        if (seed.relationship !== "Child" || index < 2) {
          const visa = permit({
            expatId: id,
            dependantId: dependant.id,
            type: "Residence permit",
            status: "Issued",
            number: `DEP/${pad(500 + position * 11 + index)}`,
            issuedBy: "Department of Immigration Zimbabwe",
            issueDate: day(-300),
            expiryDate: workPermit?.expiryDate ?? day(365),
          });
          if (person.filed) {
            file(id, "Dependant document", `Dependant's permit — ${seed.name}`, { dependantId: dependant.id, recordId: visa.id });
          }
        }
      }
      return dependant;
    });

    if (person.application) {
      const { type, status, renews, outstanding, dependant: dependantIndex } = person.application;
      const dependant = dependantIndex === undefined ? null : household[dependantIndex];
      const replaced = renews
        ? permits.find(
            (record) => record.expatId === id && record.type === type && record.dependantId === (dependant?.id ?? ""),
          )
        : undefined;
      permit({
        expatId: id,
        dependantId: dependant?.id ?? "",
        type,
        status,
        issuedBy: type === "Passport" ? `${person.nationality} embassy` : "Department of Immigration Zimbabwe",
        reference: `APP-${pad(300 + position * 9)}`,
        submittedOn: ["Submitted", "In Progress", "Approved"].includes(status) ? day(-21) : null,
        outstandingDocuments: outstanding ?? "",
        replacesId: replaced?.id ?? "",
        notes: renews ? "Renewal lodged before the current one expires." : "First application.",
      });
    }

    if (person.lease) {
      const lease: Lease = {
        id: `LSE-${pad(position + 1)}`,
        expatId: id,
        address: person.lease.address,
        landlordName: person.lease.landlord,
        landlordPhone: `+263 24 2${pad(700 + position * 7)} ${pad(100 + position)}`,
        landlordEmail: "",
        startDate: day(person.lease.expires - 365),
        expiryDate: day(person.lease.expires),
        monthlyRent: person.lease.rent,
        deposit: person.lease.rent * 2,
        currency: "USD",
        noticeDate: person.lease.noticeDays === undefined ? day(person.lease.expires - 60) : day(person.lease.noticeDays),
        status: person.lease.status ?? "Active",
        notes: "",
        ...stamp,
      };
      leases.push(lease);
      if (person.filed) file(id, "Lease agreement", `Lease — ${lease.address}`, { recordId: lease.id });
      if (position === 0) {
        // An earlier home, kept as history.
        leases.push({
          ...lease,
          id: "LSE-090",
          address: "7 Churchill Avenue, Alexandra Park, Harare",
          landlordName: "Churchill Rentals",
          startDate: day(person.lease.expires - 1095),
          expiryDate: day(person.lease.expires - 365),
          noticeDate: null,
          monthlyRent: 1500,
          deposit: 3000,
          status: "Ended",
          notes: "Moved to a larger house when the family arrived.",
        });
      }
    }

    if (person.vehicle) {
      const vehicle: Vehicle = {
        id: `VEH-${pad(position + 1)}`,
        expatId: id,
        description: person.vehicle.description,
        registration: person.vehicle.registration,
        ownership: person.vehicle.ownership,
        licenceExpiry: day(person.vehicle.licence),
        insurer: "Old Mutual Insurance",
        policyNumber: `OMI-${pad(8800 + position * 3)}`,
        insuranceExpiry: day(person.vehicle.insurance),
        status: "In use",
        notes: "",
        ...stamp,
      };
      vehicles.push(vehicle);
      if (person.filed) file(id, "Vehicle document", `Registration book — ${vehicle.registration}`, { recordId: vehicle.id });
    }

    for (const action of person.actions ?? []) {
      actionNo += 1;
      const [who, email] = action.who ?? person.manager;
      actions.push({
        id: `FUP-${pad(actionNo)}`,
        expatId: id,
        title: action.title,
        responsibleName: who,
        responsibleEmail: email,
        dueDate: day(action.due),
        status: action.status ?? "Open",
        notes: "",
        createdAt: STAMP,
        createdBy: BY,
        completedAt: "",
        ...stamp,
      });
    }
  });

  // Rajesh Kumar's earlier permit, replaced by the current one, and a done follow-up.
  const rajeshPermit = permits.find((record) => record.expatId === "EXP-001" && record.type === "Temporary employment permit");
  if (rajeshPermit) {
    const old = permit({
      expatId: "EXP-001",
      type: rajeshPermit.type,
      status: "Issued",
      number: "TEP/2022/0981",
      issuedBy: "Department of Immigration Zimbabwe",
      issueDate: addDays(rajeshPermit.issueDate ?? today, -730),
      expiryDate: rajeshPermit.issueDate,
    });
    rajeshPermit.replacesId = old.id;
    file("EXP-001", "Visa / permit", "Temporary employment permit (previous)", { recordId: old.id, historical: true });
  }
  actionNo += 1;
  actions.push({
    id: `FUP-${pad(actionNo)}`,
    expatId: "EXP-001",
    title: "Submit renewal for temporary employment permit",
    responsibleName: HR[0],
    responsibleEmail: HR[1],
    dueDate: day(-400),
    status: "Done",
    notes: "Permit issued.",
    createdAt: STAMP,
    createdBy: BY,
    completedAt: STAMP,
    ...stamp,
  });

  return { expats, dependants, permits, leases, vehicles, actions, documents, activity: [], reminders: [] };
}
