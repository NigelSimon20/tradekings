import { DependantForm, FollowUpForm, LeaseForm, PermitForm, VehicleForm } from "@/components/expats/record-forms";
import type { SelectOption } from "@/components/ui/field";
import { distinct } from "@/lib/expats/filters";
import type { Dependant, EvaluatedExpat, FollowUp, Lease, Permit, Vehicle } from "@/lib/expats/types";

/** The records a profile holds besides the expat themselves, by the name used in URLs. */
export const RECORD_KINDS = {
  dependant: { noun: "dependant", title: "dependant", permission: "editExpats" },
  permit: { noun: "record", title: "passport, permit or application", permission: "editExpats" },
  lease: { noun: "lease", title: "lease", permission: "editExpats" },
  vehicle: { noun: "vehicle", title: "vehicle", permission: "editExpats" },
  action: { noun: "follow-up", title: "follow-up", permission: "manageActions" },
} as const;
export type RecordKind = keyof typeof RECORD_KINDS;

export const isRecordKind = (value: string): value is RecordKind => Object.hasOwn(RECORD_KINDS, value);

/** Finds the record a URL names on this profile. */
export function findRecord(row: EvaluatedExpat, kind: RecordKind, id: string) {
  const lists = { dependant: row.dependants, permit: row.permits, lease: row.leases, vehicle: row.vehicles, action: row.actions };
  return (lists[kind] as { id: string }[]).find((record) => record.id === id) ?? null;
}

/** The form for one kind of record, to add (no `record`) or edit. */
export function RecordEditor({
  row,
  kind,
  record,
  restricted,
  query,
  people,
  returnTo,
}: {
  row: EvaluatedExpat;
  kind: RecordKind;
  record: object | null;
  restricted: boolean;
  /** Starting values from the link: `type`, `dependant`, `renews`. */
  query: Record<string, string>;
  /** Names to suggest as responsible people. */
  people: string[];
  returnTo?: string;
}) {
  const expatId = row.expat.id;
  const mode = record ? "edit" : "create";

  switch (kind) {
    case "dependant":
      return (
        <DependantForm
          expatId={expatId}
          mode={mode}
          defaults={(record as Dependant | null) ?? { nationality: row.expat.nationality }}
          restricted={restricted}
        />
      );
    case "permit": {
      const existing = record as Permit | null;
      const dependantId = existing?.dependantId ?? query.dependant ?? "";
      const renews = query.renews ? row.permits.find((permit) => permit.id === query.renews) : undefined;
      const whose: SelectOption[] = [
        { value: "", label: `${row.expat.fullName} (the expat)` },
        ...row.dependants
          .filter((dependant) => !dependant.archived || dependant.id === dependantId)
          .map((dependant) => ({ value: dependant.id, label: `${dependant.fullName} (${dependant.relationship})` })),
      ];
      const renewable = row.permits
        .filter((permit) => permit.status === "Issued" && permit.id !== existing?.id && (!permit.historical || permit.id === existing?.replacesId))
        .map((permit) => ({
          value: permit.id,
          label: `${permit.type} — ${permit.personName}${permit.expiryDate ? `, expires ${permit.expiryDate}` : ""}`,
        }));
      return (
        <PermitForm
          expatId={expatId}
          mode={mode}
          restricted={restricted}
          people={whose}
          renewable={renewable}
          defaults={
            existing ?? {
              dependantId,
              type: query.type ?? renews?.type ?? "",
              replacesId: renews?.id ?? "",
              issuedBy: renews?.issuedBy ?? "",
              status: renews ? "Documents Required" : "Issued",
            }
          }
        />
      );
    }
    case "lease":
      return <LeaseForm expatId={expatId} mode={mode} restricted={restricted} defaults={(record as Lease | null) ?? {}} />;
    case "vehicle":
      return <VehicleForm expatId={expatId} mode={mode} restricted={restricted} defaults={(record as Vehicle | null) ?? {}} />;
    case "action":
      return (
        <FollowUpForm
          mode={mode}
          defaults={(record as FollowUp | null) ?? { expatId, responsibleName: row.expat.managerName, responsibleEmail: row.expat.managerEmail }}
          returnTo={returnTo}
          people={distinct([...people, row.expat.managerName])}
        />
      );
  }
}
