import { tableFor } from "@/lib/expats/data/sheet-tables";
import type { ExpatData } from "@/lib/expats/types";

/**
 * "Restricted access to sensitive information": for someone without the
 * "See sensitive details" permission these fields are blanked before the data
 * reaches a page, an export or the browser — hiding them in the markup alone
 * would still send them. Saves by such a person keep the stored values
 * (`keepSensitive`), so a blank they could not see never overwrites one.
 */
export const SENSITIVE_FIELDS = {
  expats: ["dateOfBirth", "phone", "email", "residentialAddress", "emergencyName", "emergencyRelationship", "emergencyPhone"],
  dependants: ["dateOfBirth"],
  permits: ["number", "reference"],
  leases: ["address", "landlordPhone", "landlordEmail", "monthlyRent", "deposit"],
  vehicles: ["policyNumber"],
  // A title can carry a document number ("Passport A1234567").
  documents: ["url", "storedFileId", "title"],
} as const satisfies { [K in keyof ExpatData]?: readonly (keyof ExpatData[K][number])[] };

type SensitiveTable = keyof typeof SENSITIVE_FIELDS;

export function redactRecord<T extends object>(table: SensitiveTable, record: T): T {
  const copy = { ...record } as Record<string, unknown>;
  const columns: readonly { key: string; kind: string }[] = tableFor(table).columns;
  for (const key of SENSITIVE_FIELDS[table]) {
    if (!(key in copy)) continue;
    const kind = columns.find((column) => column.key === key)?.kind;
    // Dates and amounts become "not recorded", text becomes empty.
    copy[key] = kind === "date" || kind === "number" ? null : "";
  }
  return copy as T;
}

export function redactExpatData(data: ExpatData): ExpatData {
  return {
    ...data,
    expats: data.expats.map((record) => redactRecord("expats", record)),
    dependants: data.dependants.map((record) => redactRecord("dependants", record)),
    permits: data.permits.map((record) => redactRecord("permits", record)),
    leases: data.leases.map((record) => redactRecord("leases", record)),
    vehicles: data.vehicles.map((record) => redactRecord("vehicles", record)),
    documents: data.documents.map((record) => redactRecord("documents", record)),
  };
}

/** The stored record's sensitive values over a restricted editor's input. */
export function keepSensitive<T extends object>(table: SensitiveTable, before: T, after: T): T {
  const merged = { ...after } as Record<string, unknown>;
  const original = before as Record<string, unknown>;
  for (const key of SENSITIVE_FIELDS[table]) {
    if (key in original) merged[key] = original[key];
  }
  return merged as T;
}

export function isSensitiveField(table: SensitiveTable, key: string): boolean {
  return (SENSITIVE_FIELDS[table] as readonly string[]).includes(key);
}
