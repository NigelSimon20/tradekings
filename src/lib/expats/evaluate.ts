import { daysBetween, formatDate, type ISODate } from "@/lib/date/dates";
import { EXPIRY_STATUS_META, SECTION_FOR_GROUP } from "@/lib/expats/meta";
import { DEFAULT_EXPAT_RULES, type ExpatRules } from "@/lib/expats/rules";
import {
  CLOSED_APPLICATION,
  OPEN_ACTION,
  OPEN_APPLICATION,
  RIGHT_TO_WORK_TYPES,
  type Dependant,
  type EvaluatedExpat,
  type EvaluatedPermit,
  type Expat,
  type ExpatData,
  type ExpatDocument,
  type ExpiryGroup,
  type ExpiryItem,
  type ExpiryStatus,
  type Permit,
  type ProfileIssue,
  type ProfileSection,
} from "@/lib/expats/types";

/**
 * The Expat Tracker's rules engine. Pure — data and a date in, calculated
 * fields out — so every rule can be pinned to a fixed day in the tests.
 *
 * It works out, for each expat:
 *  - which passports and permits are current, which are history (replaced by
 *    a newer issued one, refused or cancelled) and which are applications;
 *  - every date to watch (permits, the contract, leases, vehicle licences and
 *    cover, dated documents), whether it is expired or in a reminder window,
 *    and whether a renewal is already under way;
 *  - the profile status: Action required, Missing documents or Complete, with
 *    the reasons.
 */

type Input = Pick<ExpatData, "expats" | "dependants" | "permits" | "leases" | "vehicles" | "actions" | "documents">;

const byExpat = <T extends { expatId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.expatId, [...(map.get(row.expatId) ?? []), row]);
  return (id: string) => map.get(id) ?? [];
};

const lines = (text: string) =>
  text
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

function permitGroup(permit: Permit): ExpiryGroup {
  if (permit.dependantId) return "Dependant documents";
  if (permit.type === "Driver's licence") return "Vehicles & licences";
  if (/insurance/i.test(permit.type)) return "Insurance";
  return "Passports & immigration";
}

export function evaluateExpats(data: Input, options: { today: ISODate; rules?: ExpatRules }): EvaluatedExpat[] {
  const { today, rules = DEFAULT_EXPAT_RULES } = options;
  const reminders = [...rules.reminderDays].sort((a, b) => a - b);
  const furthest = reminders.at(-1) ?? 0;

  const dependantsOf = byExpat(data.dependants);
  const permitsOf = byExpat(data.permits);
  const leasesOf = byExpat(data.leases);
  const vehiclesOf = byExpat(data.vehicles);
  const actionsOf = byExpat(data.actions);
  const documentsOf = byExpat(data.documents.filter((document) => !document.removed));

  const item = (
    expat: Expat,
    fields: Pick<ExpiryItem, "key" | "kind" | "group" | "reference" | "recordId"> & {
      expiryDate: ISODate;
      dependant?: Dependant | null;
      handled?: boolean;
      section?: ProfileSection;
    },
  ): ExpiryItem => {
    const daysRemaining = daysBetween(today, fields.expiryDate);
    const status: ExpiryStatus = daysRemaining < 0 ? "EXPIRED" : daysRemaining <= furthest ? "EXPIRING" : "VALID";
    const handled = Boolean(fields.handled);
    return {
      key: fields.key,
      expatId: expat.id,
      expatName: expat.fullName,
      personName: fields.dependant?.fullName || expat.fullName,
      dependantId: fields.dependant?.id ?? "",
      kind: fields.kind,
      group: fields.group,
      reference: fields.reference,
      recordId: fields.recordId,
      section: fields.section ?? SECTION_FOR_GROUP[fields.group],
      expiryDate: fields.expiryDate,
      daysRemaining,
      status,
      reminderDays: status === "EXPIRING" ? (reminders.find((threshold) => daysRemaining <= threshold) ?? null) : null,
      renewalInProgress: handled,
      needsAction: status !== "VALID" && !handled,
      responsibleName: expat.managerName,
      responsibleEmail: expat.managerEmail,
    };
  };

  return data.expats.map((expat): EvaluatedExpat => {
    const dependants = dependantsOf(expat.id);
    const household = dependants.filter((dependant) => !dependant.archived);
    const dependantById = new Map(dependants.map((dependant) => [dependant.id, dependant]));
    const documents = documentsOf(expat.id);
    const rawPermits = permitsOf(expat.id);
    const leases = leasesOf(expat.id);
    const vehicles = vehiclesOf(expat.id);
    const actions = actionsOf(expat.id);
    const live = !expat.archived;

    const replacedBy = new Map<string, Permit[]>();
    for (const permit of rawPermits) {
      if (permit.replacesId) replacedBy.set(permit.replacesId, [...(replacedBy.get(permit.replacesId) ?? []), permit]);
    }

    const permits = rawPermits.map((permit): EvaluatedPermit => {
      const replacements = replacedBy.get(permit.id) ?? [];
      const historical =
        CLOSED_APPLICATION.includes(permit.status) || replacements.some((next) => next.status === "Issued");
      const current = permit.status === "Issued" && !historical;
      const inProgress = OPEN_APPLICATION.includes(permit.status);
      const renewal = replacements.find((next) => OPEN_APPLICATION.includes(next.status)) ?? null;
      const dependant = permit.dependantId ? (dependantById.get(permit.dependantId) ?? null) : null;
      const inHousehold = !dependant || !dependant.archived;
      const group = permitGroup(permit);
      return {
        ...permit,
        personName: dependant?.fullName || expat.fullName,
        current,
        historical,
        inProgress,
        renewal,
        outstanding: inProgress ? lines(permit.outstandingDocuments) : [],
        expiry:
          live && current && inHousehold && permit.expiryDate
            ? item(expat, {
                key: `permit:${permit.id}`,
                kind: permit.type,
                group,
                reference: permit.number,
                recordId: permit.id,
                expiryDate: permit.expiryDate,
                dependant,
                handled: renewal !== null,
              })
            : null,
        documentCount: documents.filter((document) => document.recordId === permit.id).length,
      };
    });

    const expiries: ExpiryItem[] = [];
    if (live) {
      for (const permit of permits) if (permit.expiry) expiries.push(permit.expiry);
      if (expat.contractEnd) {
        expiries.push(
          item(expat, {
            key: `contract:${expat.id}`,
            kind: "Employment contract",
            group: "Employment",
            reference: expat.position,
            recordId: expat.id,
            expiryDate: expat.contractEnd,
          }),
        );
      }
      for (const lease of leases) {
        if (lease.status === "Ended") continue;
        // Renewing or moving out is already being handled.
        const handled = lease.status !== "Active";
        if (lease.expiryDate) {
          expiries.push(
            item(expat, {
              key: `lease:${lease.id}`,
              kind: "Lease",
              group: "Accommodation",
              reference: lease.address,
              recordId: lease.id,
              expiryDate: lease.expiryDate,
              handled,
            }),
          );
        }
        if (lease.noticeDate && lease.status === "Active") {
          expiries.push(
            item(expat, {
              key: `lease-notice:${lease.id}`,
              kind: "Lease notice / renewal date",
              group: "Accommodation",
              reference: lease.address,
              recordId: lease.id,
              expiryDate: lease.noticeDate,
            }),
          );
        }
      }
      for (const vehicle of vehicles) {
        if (vehicle.status !== "In use") continue;
        const reference = [vehicle.registration, vehicle.description].filter(Boolean).join(" · ");
        if (vehicle.licenceExpiry) {
          expiries.push(
            item(expat, {
              key: `vehicle-licence:${vehicle.id}`,
              kind: "Vehicle licence",
              group: "Vehicles & licences",
              reference,
              recordId: vehicle.id,
              expiryDate: vehicle.licenceExpiry,
            }),
          );
        }
        if (vehicle.insuranceExpiry) {
          expiries.push(
            item(expat, {
              key: `vehicle-insurance:${vehicle.id}`,
              kind: "Vehicle insurance",
              group: "Insurance",
              reference,
              recordId: vehicle.id,
              expiryDate: vehicle.insuranceExpiry,
              section: "vehicles",
            }),
          );
        }
      }
      // A dated document that is not the copy of a tracked record (a medical
      // certificate, say) is watched on its own.
      for (const document of documents) {
        if (!document.expiryDate || document.historical || document.recordId) continue;
        const dependant = document.dependantId ? (dependantById.get(document.dependantId) ?? null) : null;
        if (dependant?.archived) continue;
        expiries.push(
          item(expat, {
            key: `document:${document.id}`,
            kind: document.category,
            group: dependant ? "Dependant documents" : "Other documents",
            reference: document.title,
            recordId: document.id,
            expiryDate: document.expiryDate,
            dependant,
          }),
        );
      }
    }
    expiries.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const openActions = actions.filter((action) => OPEN_ACTION.includes(action.status));
    const overdue = openActions.filter((action) => action.dueDate && action.dueDate < today);
    const openApplications = permits.filter((permit) => permit.inProgress);

    const issues: ProfileIssue[] = [];
    if (live) {
      for (const expiry of expiries) {
        if (!expiry.needsAction) continue;
        const whose = expiry.dependantId ? ` (${expiry.personName})` : "";
        issues.push({
          status: "ACTION_REQUIRED",
          section: expiry.section,
          text:
            expiry.status === "EXPIRED"
              ? `${expiry.kind}${whose} expired ${Math.abs(expiry.daysRemaining)} days ago (${formatDate(expiry.expiryDate)})`
              : `${expiry.kind}${whose} expires in ${expiry.daysRemaining} days (${formatDate(expiry.expiryDate)}) — renewal not started`,
        });
      }
      for (const action of overdue) {
        issues.push({ status: "ACTION_REQUIRED", section: "actions", text: `Follow-up overdue: ${action.title}` });
      }

      const holds = (dependantId: string, types: readonly string[]) =>
        permits.some(
          (permit) => permit.dependantId === dependantId && types.includes(permit.type) && (permit.current || permit.inProgress),
        );
      if (!holds("", ["Passport"])) {
        issues.push({ status: "MISSING_DOCUMENTS", section: "immigration", text: "No passport recorded" });
      }
      if (!holds("", RIGHT_TO_WORK_TYPES)) {
        issues.push({ status: "MISSING_DOCUMENTS", section: "immigration", text: "No work or residence permit recorded" });
      }
      for (const dependant of household) {
        if (!holds(dependant.id, ["Passport"])) {
          issues.push({ status: "MISSING_DOCUMENTS", section: "household", text: `No passport recorded for ${dependant.fullName}` });
        }
      }
      for (const permit of permits) {
        const whose = permit.dependantId ? ` for ${permit.personName}` : "";
        const dependant = permit.dependantId ? dependantById.get(permit.dependantId) : null;
        if (dependant?.archived) continue;
        if (permit.current && !permit.documentCount) {
          issues.push({
            status: "MISSING_DOCUMENTS",
            section: permit.dependantId ? "household" : "immigration",
            text: `No copy of the ${permit.type.toLowerCase()}${whose} on file`,
          });
        }
        if (permit.outstanding.length) {
          issues.push({
            status: "MISSING_DOCUMENTS",
            section: permit.dependantId ? "household" : "immigration",
            text: `${permit.type} application${whose} is waiting for: ${permit.outstanding.join(", ")}`,
          });
        }
      }
      if (!documents.some((document) => document.category === "Employment contract" && !document.historical)) {
        issues.push({ status: "MISSING_DOCUMENTS", section: "employment", text: "No employment contract on file" });
      }
      for (const lease of leases) {
        if (lease.status === "Ended") continue;
        if (!documents.some((document) => document.recordId === lease.id)) {
          issues.push({ status: "MISSING_DOCUMENTS", section: "accommodation", text: "No lease agreement on file" });
        }
      }
    }

    const status = issues.some((issue) => issue.status === "ACTION_REQUIRED")
      ? "ACTION_REQUIRED"
      : issues.length
        ? "MISSING_DOCUMENTS"
        : "COMPLETE";

    const currentLease =
      [...leases]
        .filter((lease) => lease.status !== "Ended")
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))[0] ?? null;

    return {
      expat,
      dependants,
      permits,
      leases,
      vehicles,
      actions,
      documents,
      expiries,
      status,
      issues,
      openActions: openActions.length,
      overdueActions: overdue.length,
      applicationsInProgress: openApplications.length,
      nextExpiry: expiries.find((expiry) => expiry.daysRemaining >= 0) ?? null,
      currentLease,
    };
  });
}

/**
 * Whether a document is the copy in force or history: marked historical, or
 * the permit it supports was replaced, the lease ended, the vehicle returned,
 * or the dependant left the household.
 */
export function isHistoricalDocument(row: EvaluatedExpat, document: ExpatDocument): boolean {
  if (document.historical) return true;
  if (document.dependantId && row.dependants.find((dependant) => dependant.id === document.dependantId)?.archived) return true;
  if (!document.recordId) return false;
  const permit = row.permits.find((record) => record.id === document.recordId);
  if (permit) return permit.historical;
  const lease = row.leases.find((record) => record.id === document.recordId);
  if (lease) return lease.status === "Ended";
  const vehicle = row.vehicles.find((record) => record.id === document.recordId);
  if (vehicle) return vehicle.status !== "In use";
  return false;
}

/** Most urgent first: expired, then expiring soonest, then the rest by date. */
export function sortExpiries(items: ExpiryItem[]): ExpiryItem[] {
  return [...items].sort(
    (a, b) =>
      EXPIRY_STATUS_META[a.status].priority - EXPIRY_STATUS_META[b.status].priority ||
      a.daysRemaining - b.daysRemaining ||
      a.expatName.localeCompare(b.expatName),
  );
}
