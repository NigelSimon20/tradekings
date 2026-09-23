import { z } from "zod";

import { isISODate } from "@/lib/date/dates";
import {
  COMPANIES,
  CONTRACT_TYPES,
  RENEWAL_STATUSES,
  WORKER_TYPES,
  type ContractInput,
} from "@/lib/domain/types";

const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Enter a valid email address",
  });

const isoDate = z
  .string()
  .trim()
  .refine((value) => isISODate(value), { message: "Use the date picker (yyyy-mm-dd)" });

/** Validation for the contract form, shared by the client and the server action. */
export const contractSchema = z
  .object({
    id: z.string().trim().optional(),
    employeeId: z.string().trim().min(1, "Employee ID is required"),
    employeeName: z.string().trim().min(1, "Employee name is required"),
    employeeEmail: optionalEmail,
    company: z.enum(COMPANIES),
    workerType: z.enum(WORKER_TYPES),
    department: z.string().trim(),
    costCentre: z.string().trim(),
    jobTitle: z.string().trim(),
    contractType: z.enum(CONTRACT_TYPES),
    startDate: isoDate,
    endDate: isoDate,
    contractNumber: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : Number(value)))
      .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
        message: "Contract number must be a whole number",
      }),
    renewalStatus: z.enum(RENEWAL_STATUSES),
    hrPerson: z.string().trim(),
    hrEmail: optionalEmail,
    manager: z.string().trim(),
    managerEmail: optionalEmail,
    location: z.string().trim(),
    notes: z.string().trim(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "The end date must be on or after the start date",
    path: ["endDate"],
  });

export interface ParsedForm {
  ok: boolean;
  values: ContractInput | null;
  errors: Record<string, string>;
}

/** Parses and validates a submitted contract form. */
export function parseContractForm(formData: FormData): ParsedForm {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );

  const result = contractSchema.safeParse({
    id: raw.id ?? "",
    employeeId: raw.employeeId ?? "",
    employeeName: raw.employeeName ?? "",
    employeeEmail: raw.employeeEmail ?? "",
    company: raw.company ?? COMPANIES[0],
    workerType: raw.workerType ?? WORKER_TYPES[0],
    department: raw.department ?? "",
    costCentre: raw.costCentre ?? "",
    jobTitle: raw.jobTitle ?? "",
    contractType: raw.contractType ?? CONTRACT_TYPES[0],
    startDate: raw.startDate ?? "",
    endDate: raw.endDate ?? "",
    contractNumber: raw.contractNumber ?? "",
    renewalStatus: raw.renewalStatus ?? RENEWAL_STATUSES[0],
    hrPerson: raw.hrPerson ?? "",
    hrEmail: raw.hrEmail ?? "",
    manager: raw.manager ?? "",
    managerEmail: raw.managerEmail ?? "",
    location: raw.location ?? "",
    notes: raw.notes ?? "",
  });

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, values: null, errors };
  }

  const { id, ...rest } = result.data;
  return { ok: true, values: { ...rest, id: id || undefined }, errors: {} };
}
