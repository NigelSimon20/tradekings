import type { Contract } from "@/lib/domain/types";

let sequence = 0;

/** Builds a contract row with sensible defaults, for tests and sample data. */
export function makeContract(overrides: Partial<Contract> = {}): Contract {
  sequence += 1;
  return {
    id: `C-${String(sequence).padStart(4, "0")}`,
    employeeId: "E-001",
    employeeName: "Test Employee",
    employeeEmail: "",
    company: "Trade Kings",
    workerType: "Blue Collar",
    department: "Production",
    costCentre: "CC-100",
    jobTitle: "Machine Operator",
    contractType: "New",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    contractNumber: null,
    renewalStatus: "Pending",
    hrPerson: "HR Officer",
    hrEmail: "hr@example.com",
    manager: "Line Manager",
    managerEmail: "manager@example.com",
    location: "Harare",
    notes: "",
    lastUpdated: null,
    ...overrides,
  };
}

export function resetContractSequence(): void {
  sequence = 0;
}
