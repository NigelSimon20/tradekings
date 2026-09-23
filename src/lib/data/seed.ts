import { addDays, type ISODate } from "@/lib/date/dates";
import type { Company, Contract, ContractType, RenewalStatus, WorkerType } from "@/lib/domain/types";

/**
 * Sample data for the local data source.
 *
 * Dates are generated relative to "today" so the demo always shows the full
 * range of statuses: overdue, expiring, active, casual limits and rehire
 * waiting periods.
 */
interface SeedContract {
  startOffset: number;
  endOffset: number;
  contractType?: ContractType;
  renewalStatus?: RenewalStatus;
  contractNumber?: number;
  notes?: string;
}

interface SeedEmployee {
  employeeId: string;
  employeeName: string;
  company: Company;
  workerType: WorkerType;
  department: string;
  costCentre: string;
  jobTitle: string;
  manager: string;
  managerEmail: string;
  hrPerson: string;
  hrEmail: string;
  location: string;
  contracts: SeedContract[];
}

const HR = {
  tk: { hrPerson: "Rutendo Moyo", hrEmail: "rutendo.moyo@example.com" },
  zk: { hrPerson: "Tapiwa Ncube", hrEmail: "tapiwa.ncube@example.com" },
};

const MANAGERS = {
  production: { manager: "Farai Chikore", managerEmail: "farai.chikore@example.com" },
  packaging: { manager: "Nyasha Dube", managerEmail: "nyasha.dube@example.com" },
  warehouse: { manager: "Blessing Sibanda", managerEmail: "blessing.sibanda@example.com" },
  transport: { manager: "Kudzai Mutasa", managerEmail: "kudzai.mutasa@example.com" },
};

/** Six consecutive weekly casual contracts, most recent ending `lastEnd` days out. */
function weeklyRun(count: number, lastEndOffset: number): SeedContract[] {
  return Array.from({ length: count }, (_, index) => {
    const position = count - 1 - index;
    const endOffset = lastEndOffset - position * 7;
    return {
      startOffset: endOffset - 6,
      endOffset,
      contractType: index === 0 ? ("New" as const) : ("Renewal" as const),
    };
  });
}

const SEED_EMPLOYEES: SeedEmployee[] = [
  {
    employeeId: "TK-0101",
    employeeName: "Tendai Marufu",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Production",
    costCentre: "CC-2100",
    jobTitle: "Machine Operator",
    location: "Harare Plant",
    ...MANAGERS.production,
    ...HR.tk,
    contracts: [
      { startOffset: -545, endOffset: -366, renewalStatus: "Renewed" },
      { startOffset: -365, endOffset: -186, contractType: "Renewal", renewalStatus: "Renewed" },
      { startOffset: -185, endOffset: -5, contractType: "Renewal" },
    ],
  },
  {
    employeeId: "TK-0102",
    employeeName: "Chiedza Nyoni",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Packaging",
    costCentre: "CC-2200",
    jobTitle: "Packer",
    location: "Harare Plant",
    ...MANAGERS.packaging,
    ...HR.tk,
    contracts: [{ startOffset: -170, endOffset: 10, contractType: "Renewal", contractNumber: 3 }],
  },
  {
    employeeId: "TK-0103",
    employeeName: "Simbarashe Gwenzi",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Warehouse",
    costCentre: "CC-2300",
    jobTitle: "Forklift Driver",
    location: "Msasa Depot",
    ...MANAGERS.warehouse,
    ...HR.tk,
    contracts: [{ startOffset: -155, endOffset: 25, renewalStatus: "In Progress" }],
  },
  {
    employeeId: "TK-0104",
    employeeName: "Rufaro Katsande",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Production",
    costCentre: "CC-2100",
    jobTitle: "Line Attendant",
    location: "Harare Plant",
    ...MANAGERS.production,
    ...HR.tk,
    contracts: [{ startOffset: -180, endOffset: 0 }],
  },
  {
    employeeId: "TK-0105",
    employeeName: "Tanaka Zvirekwi",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Transport",
    costCentre: "CC-2400",
    jobTitle: "Driver",
    location: "Msasa Depot",
    ...MANAGERS.transport,
    ...HR.tk,
    contracts: [{ startOffset: -200, endOffset: -20, notes: "Renewal pack with HR for signature." }],
  },
  {
    employeeId: "TK-0106",
    employeeName: "Memory Chipo",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Quality",
    costCentre: "CC-2500",
    jobTitle: "Quality Checker",
    location: "Harare Plant",
    ...MANAGERS.production,
    ...HR.tk,
    contracts: [{ startOffset: -100, endOffset: 80 }],
  },
  {
    employeeId: "TK-0107",
    employeeName: "Gilbert Manyika",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Warehouse",
    costCentre: "CC-2300",
    jobTitle: "Stores Assistant",
    location: "Msasa Depot",
    ...MANAGERS.warehouse,
    ...HR.tk,
    contracts: [{ startOffset: -178, endOffset: 2, renewalStatus: "Pending" }],
  },
  {
    employeeId: "ZK-0201",
    employeeName: "Lovemore Sithole",
    company: "Zimkings",
    workerType: "Blue Collar",
    department: "Distribution",
    costCentre: "CC-3100",
    jobTitle: "Loader",
    location: "Bulawayo Depot",
    ...MANAGERS.warehouse,
    ...HR.zk,
    contracts: [
      { startOffset: -1460, endOffset: -1096, renewalStatus: "Renewed" },
      { startOffset: -1095, endOffset: -731, contractType: "Renewal", renewalStatus: "Renewed" },
      { startOffset: -730, endOffset: -366, contractType: "Renewal", renewalStatus: "Renewed" },
      { startOffset: -365, endOffset: -1, contractType: "Renewal", renewalStatus: "Renewed" },
      { startOffset: 0, endOffset: 364, contractType: "Renewal" },
    ],
  },
  {
    employeeId: "ZK-0202",
    employeeName: "Precious Moyo",
    company: "Zimkings",
    workerType: "Blue Collar",
    department: "Retail Support",
    costCentre: "CC-3200",
    jobTitle: "Merchandiser",
    location: "Bulawayo Depot",
    ...MANAGERS.packaging,
    ...HR.zk,
    contracts: [
      { startOffset: -1095, endOffset: -731, renewalStatus: "Renewed", contractNumber: 1 },
      { startOffset: -730, endOffset: -366, contractType: "Renewal", renewalStatus: "Renewed" },
      { startOffset: -365, endOffset: -14, contractType: "Renewal", renewalStatus: "Renewed" },
      { startOffset: -13, endOffset: 12, contractType: "Renewal", notes: "Short bridging contract." },
    ],
  },
  {
    employeeId: "ZK-0203",
    employeeName: "Nokuthula Ndlovu",
    company: "Zimkings",
    workerType: "Blue Collar",
    department: "Distribution",
    costCentre: "CC-3100",
    jobTitle: "Checker",
    location: "Gweru Depot",
    ...MANAGERS.transport,
    ...HR.zk,
    contracts: [{ startOffset: -60, endOffset: 366, notes: "Captured with a 14 month term." }],
  },
  {
    employeeId: "ZK-0204",
    employeeName: "Trymore Banda",
    company: "Zimkings",
    workerType: "Blue Collar",
    department: "Retail Support",
    costCentre: "CC-3200",
    jobTitle: "Shelf Packer",
    location: "Bulawayo Depot",
    ...MANAGERS.packaging,
    ...HR.zk,
    contracts: [{ startOffset: -350, endOffset: 15, contractNumber: 2, contractType: "Renewal" }],
  },
  {
    employeeId: "ZK-0205",
    employeeName: "Sibusiso Phiri",
    company: "Zimkings",
    workerType: "Blue Collar",
    department: "Distribution",
    costCentre: "CC-3100",
    jobTitle: "Loader",
    location: "Gweru Depot",
    ...MANAGERS.warehouse,
    ...HR.zk,
    contracts: [{ startOffset: -400, endOffset: -35, renewalStatus: "Pending" }],
  },
  {
    employeeId: "TKC-0301",
    employeeName: "Anesu Chirwa",
    company: "Trade Kings",
    workerType: "Casual",
    department: "Packaging",
    costCentre: "CC-2200",
    jobTitle: "Casual Packer",
    location: "Harare Plant",
    ...MANAGERS.packaging,
    ...HR.tk,
    contracts: weeklyRun(6, -9),
  },
  {
    employeeId: "TKC-0302",
    employeeName: "Panashe Makoni",
    company: "Trade Kings",
    workerType: "Casual",
    department: "Packaging",
    costCentre: "CC-2200",
    jobTitle: "Casual Packer",
    location: "Harare Plant",
    ...MANAGERS.packaging,
    ...HR.tk,
    contracts: weeklyRun(5, 2),
  },
  {
    employeeId: "TKC-0303",
    employeeName: "Shamiso Dube",
    company: "Trade Kings",
    workerType: "Casual",
    department: "Warehouse",
    costCentre: "CC-2300",
    jobTitle: "Casual Loader",
    location: "Msasa Depot",
    ...MANAGERS.warehouse,
    ...HR.tk,
    contracts: weeklyRun(3, 3),
  },
  {
    employeeId: "TKC-0304",
    employeeName: "Brian Tafirenyika",
    company: "Trade Kings",
    workerType: "Casual",
    department: "Production",
    costCentre: "CC-2100",
    jobTitle: "Casual Operator",
    location: "Harare Plant",
    ...MANAGERS.production,
    ...HR.tk,
    contracts: weeklyRun(6, -100),
  },
  {
    employeeId: "ZKC-0401",
    employeeName: "Melody Chataika",
    company: "Zimkings",
    workerType: "Casual",
    department: "Distribution",
    costCentre: "CC-3100",
    jobTitle: "Casual Checker",
    location: "Bulawayo Depot",
    ...MANAGERS.transport,
    ...HR.zk,
    contracts: weeklyRun(6, -2),
  },
  {
    employeeId: "ZKC-0402",
    employeeName: "Takudzwa Mlambo",
    company: "Zimkings",
    workerType: "Casual",
    department: "Retail Support",
    costCentre: "CC-3200",
    jobTitle: "Casual Merchandiser",
    location: "Gweru Depot",
    ...MANAGERS.packaging,
    ...HR.zk,
    contracts: [...weeklyRun(6, -120), { startOffset: -4, endOffset: 2, contractType: "Rehire" }],
  },
  {
    employeeId: "ZKC-0403",
    employeeName: "Rejoice Kamba",
    company: "Zimkings",
    workerType: "Casual",
    department: "Distribution",
    costCentre: "CC-3100",
    jobTitle: "Casual Loader",
    location: "Bulawayo Depot",
    manager: "Blessing Sibanda",
    managerEmail: "",
    ...HR.zk,
    contracts: weeklyRun(4, 1),
  },
];

export function buildSeedContracts(today: ISODate): Contract[] {
  const contracts: Contract[] = [];

  for (const employee of SEED_EMPLOYEES) {
    employee.contracts.forEach((seed, index) => {
      const prefix = employee.company === "Zimkings" ? "ZK" : "TK";
      contracts.push({
        id: `${prefix}-${employee.employeeId.replace(/\W/g, "")}-${String(index + 1).padStart(2, "0")}`,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        employeeEmail: "",
        company: employee.company,
        workerType: employee.workerType,
        department: employee.department,
        costCentre: employee.costCentre,
        jobTitle: employee.jobTitle,
        contractType: seed.contractType ?? "New",
        startDate: addDays(today, seed.startOffset),
        endDate: addDays(today, seed.endOffset),
        contractNumber: seed.contractNumber ?? null,
        renewalStatus: seed.renewalStatus ?? "Pending",
        hrPerson: employee.hrPerson,
        hrEmail: employee.hrEmail,
        manager: employee.manager,
        managerEmail: employee.managerEmail,
        location: employee.location,
        notes: seed.notes ?? "",
        lastUpdated: null,
        lastUpdatedBy: "",
      });
    });
  }

  return contracts;
}
