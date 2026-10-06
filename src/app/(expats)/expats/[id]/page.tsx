import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ExpiryCell, Hidden, ProfileStatusBadge } from "@/components/expats/badges";
import { ArchiveDependantButton, RestoreExpatButton } from "@/components/expats/controls";
import { DocumentList } from "@/components/expats/document-list";
import { ExpiryTable } from "@/components/expats/expiry-table";
import { FollowUpList } from "@/components/expats/follow-up-list";
import { PermitTable, addPermitHref } from "@/components/expats/permit-table";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertIcon,
  ArrowLeftIcon,
  BuildingIcon,
  CalendarIcon,
  ClipboardIcon,
  PassportIcon,
  PlusIcon,
  PrintIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { canExpats } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { formatDate, formatTimestamp } from "@/lib/date/dates";
import { LEASE_STATUS_TONE, VEHICLE_STATUS_TONE } from "@/lib/expats/meta";
import { getPhotoStore } from "@/lib/files";
import { OPEN_ACTION, RIGHT_TO_WORK_TYPES, type EvaluatedPermit, type ExpiryItem } from "@/lib/expats/types";
import { requireExpatViewer } from "@/lib/services/auth";
import { getExpatProfile } from "@/lib/services/expats";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

export const dynamic = "force-dynamic";

const dash = <span className="text-slate-400">—</span>;
const or = (value: ReactNode) => (value === "" || value === null || value === undefined ? dash : value);

function money(amount: number | null, currency: string): string {
  if (amount === null) return "";
  return `${currency || ""} ${amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`.trim();
}

/** The expat's dedicated profile: everything about them and their household, in one place. */
export default async function ExpatProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireExpatViewer("viewExpats");
  const { id } = await params;
  const profile = await getExpatProfile(user, decodeURIComponent(id));
  if (!profile) notFound();

  const { row, snapshot, activity } = profile;
  const { expat } = row;
  const { restricted, today } = snapshot;
  const config = getConfig();
  const base = `/expats/${encodeURIComponent(expat.id)}`;
  const live = !expat.archived;
  const mayEdit = canExpats(user, "editExpats") && live;
  const mayManageActions = canExpats(user, "manageActions") && live;
  const uploadsOn = (await getPhotoStore("expats")).kind !== "none";
  const sensitive = (value: ReactNode) => (restricted ? <Hidden /> : or(value));

  const household = row.dependants.filter((dependant) => !dependant.archived);
  const former = row.dependants.filter((dependant) => dependant.archived);
  const own = row.permits.filter((permit) => !permit.dependantId);
  const ownCurrent = own.filter((permit) => !permit.historical);
  const ownHistory = own.filter((permit) => permit.historical);
  const permitsOf = (dependantId: string) => row.permits.filter((permit) => permit.dependantId === dependantId);
  const currentOf = (dependantId: string, types: readonly string[]): EvaluatedPermit | undefined =>
    permitsOf(dependantId).find((permit) => (permit.current || permit.inProgress) && types.includes(permit.type));
  const currentLeases = row.leases.filter((lease) => lease.status !== "Ended");
  const pastLeases = row.leases.filter((lease) => lease.status === "Ended");
  const vehiclesInUse = row.vehicles.filter((vehicle) => vehicle.status === "In use");
  const pastVehicles = row.vehicles.filter((vehicle) => vehicle.status !== "In use");
  const actions = [...row.actions].sort(
    (a, b) =>
      Number(OPEN_ACTION.includes(b.status)) - Number(OPEN_ACTION.includes(a.status)) ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
  );
  const leaseExpiry = (leaseId: string): ExpiryItem | null =>
    row.expiries.find((item) => item.recordId === leaseId && item.kind === "Lease") ?? null;
  const vehicleExpiry = (vehicleId: string, kind: string) =>
    row.expiries.find((item) => item.recordId === vehicleId && item.kind === kind) ?? null;

  const statusCell = (permit: EvaluatedPermit | undefined) =>
    !permit ? (
      <Badge tone="caution">None recorded</Badge>
    ) : permit.inProgress ? (
      <Badge tone="info">{`Applying — ${permit.status}`}</Badge>
    ) : permit.expiry ? (
      <ExpiryCell item={permit.expiry} />
    ) : (
      <span className="text-xs text-slate-500">{permit.type}, no expiry date</span>
    );

  return (
    <div className="space-y-6">
      <Link href="/expats/people" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        Expats
      </Link>

      <PageHeader
        eyebrow={[expat.id, expat.employeeNumber, expat.company].filter(Boolean).join(" · ")}
        title={expat.fullName}
        description={[expat.position, expat.department, expat.nationality].filter(Boolean).join(" · ")}
        actions={
          <>
            <ButtonLink href={`${base}/summary`} variant="secondary">
              <PrintIcon className="size-4" />
              Summary
            </ButtonLink>
            {mayEdit ? (
              <ButtonLink href={`${base}/edit`} variant="secondary">
                Edit profile
              </ButtonLink>
            ) : null}
            {canExpats(user, "offboardExpats") && live ? (
              <ButtonLink href={`${base}/offboard`} variant="secondary">
                Offboard
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {expat.archived ? (
        <Card>
          <CardHeader
            title="Offboarded"
            description="This profile is archived — kept with all its history, but off the dashboard, lists and reminders."
            action={canExpats(user, "offboardExpats") ? <RestoreExpatButton expatId={expat.id} /> : null}
          />
          <CardBody>
            <DefinitionList
              columns={3}
              items={[
                { label: "Departure date", value: or(formatDate(expat.departureDate)) },
                { label: "Reason", value: or(expat.departureReason) },
                { label: "Permit closure / cancellation", value: or(expat.permitClosure) },
                { label: "Property handover", value: or(expat.propertyHandover) },
                { label: "Vehicle return", value: or(expat.vehicleReturn) },
                { label: "Outstanding actions", value: <span className="whitespace-pre-line">{or(expat.outstandingActions)}</span> },
                { label: "Final notes", value: <span className="whitespace-pre-line">{or(expat.offboardingNotes)}</span> },
              ]}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            icon={<AlertIcon className="size-4" />}
            title="Profile status"
            description={row.issues.length ? "What needs doing to make this profile complete." : "Everything is on file and in date."}
            action={<ProfileStatusBadge status={row.status} />}
          />
          {row.issues.length ? (
            <ul className="divide-y divide-slate-100">
              {row.issues.map((issue) => (
                <li key={issue.text}>
                  <a href={`#${issue.section}`} className="flex items-start gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        TONE_CLASSES[issue.status === "ACTION_REQUIRED" ? "critical" : "caution"].dot,
                      )}
                      aria-hidden
                    />
                    <span className="text-slate-800">{issue.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      )}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card id="employment" className="scroll-mt-24">
          <CardHeader
            icon={<UsersIcon className="size-4" />}
            title="Personal & employment"
            description={restricted ? "Some details are hidden from your role." : undefined}
          />
          <CardBody className="space-y-6">
            <DefinitionList
              columns={3}
              items={[
                { label: "Nationality", value: or(expat.nationality) },
                { label: "Date of birth", value: sensitive(formatDate(expat.dateOfBirth)) },
                { label: "Employee number", value: or(expat.employeeNumber) },
                { label: "Phone", value: sensitive(expat.phone) },
                { label: "Email", value: restricted ? <Hidden /> : expat.email ? <a href={`mailto:${expat.email}`} className="text-brand-700 hover:underline">{expat.email}</a> : dash },
                { label: "Residential address", value: sensitive(expat.residentialAddress) },
                {
                  label: "Emergency contact",
                  value: restricted ? <Hidden /> : or([expat.emergencyName, expat.emergencyRelationship && `(${expat.emergencyRelationship})`, expat.emergencyPhone].filter(Boolean).join(" ")),
                },
              ]}
            />
            <DefinitionList
              columns={3}
              className="border-t border-slate-100 pt-5"
              items={[
                { label: "Company", value: or(expat.company) },
                { label: "Department", value: or(expat.department) },
                { label: "Position", value: or(expat.position) },
                {
                  label: "Responsible manager",
                  value: expat.managerEmail ? (
                    <a href={`mailto:${expat.managerEmail}`} className="text-brand-700 hover:underline">
                      {expat.managerName || expat.managerEmail}
                    </a>
                  ) : (
                    or(expat.managerName)
                  ),
                },
                { label: "Employment status", value: expat.employmentStatus },
                { label: "Employment start", value: or(formatDate(expat.employmentStart)) },
                {
                  label: "Contract end",
                  value: expat.contractEnd ? <ExpiryCell item={row.expiries.find((item) => item.kind === "Employment contract") ?? null} /> : dash,
                },
                { label: "Notes", value: <span className="whitespace-pre-line">{or(expat.notes)}</span> },
                {
                  label: "Last updated",
                  value: `${formatTimestamp(expat.lastUpdated, config.timezone)}${expat.lastUpdatedBy ? ` by ${expat.lastUpdatedBy}` : ""}`,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<CalendarIcon className="size-4" />}
            title="Dates to watch"
            description="This household's expiries, soonest first."
            action={
              <ButtonLink href={`/expats/expiries?expat=${encodeURIComponent(expat.id)}`} variant="secondary" size="sm">
                In the expiry view
              </ButtonLink>
            }
          />
          <ExpiryTable
            items={[...row.expiries].sort((a, b) => a.daysRemaining - b.daysRemaining)}
            restricted={restricted}
            showPerson={false}
            emptyTitle={live ? "No dates recorded" : "Not watched once offboarded"}
            emptyDescription={live ? "Add passports, permits, a lease or a vehicle to start tracking." : "Restore the profile to watch its dates again."}
          />
        </Card>
      </div>

      <Card id="immigration" className="scroll-mt-24">
        <CardHeader
          icon={<PassportIcon className="size-4" />}
          title="Passport & immigration"
          description="Passports, visas, work and residence permits, driver's licence and medical cover — and applications for them."
          action={
            mayEdit ? (
              <ButtonLink href={addPermitHref(expat.id, {})} size="sm">
                <PlusIcon />
                Add document or application
              </ButtonLink>
            ) : null
          }
        />
        {ownCurrent.length ? (
          <PermitTable permits={ownCurrent} restricted={restricted} mayEdit={mayEdit} />
        ) : (
          <EmptyState icon={<PassportIcon className="size-5" />} title="Nothing recorded yet" description="Add the passport and work or residence permit first." />
        )}
        {ownHistory.length ? (
          <details className="border-t border-slate-100 px-5 py-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
              History — {ownHistory.length} replaced, refused or cancelled
            </summary>
            <div className="mt-3 -mx-5">
              <PermitTable permits={ownHistory} restricted={restricted} mayEdit={mayEdit} />
            </div>
          </details>
        ) : null}
      </Card>

      <Card id="household" className="scroll-mt-24">
        <CardHeader
          icon={<UsersIcon className="size-4" />}
          title="Family / household"
          description="The expat and everyone with them, with their key documents side by side."
          action={
            mayEdit ? (
              <ButtonLink href={`${base}/add/dependant`} size="sm">
                <PlusIcon />
                Add dependant
              </ButtonLink>
            ) : null
          }
        />
        <TableWrap>
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th>Person</Th>
                <Th className="hidden md:table-cell">Date of birth</Th>
                <Th>Passport</Th>
                <Th>Visa / permit</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td>
                  <p className="font-medium text-slate-900">{expat.fullName}</p>
                  <p className="text-xs text-slate-500">The expat · {expat.nationality}</p>
                </Td>
                <Td className="hidden md:table-cell">{sensitive(formatDate(expat.dateOfBirth))}</Td>
                <Td>{statusCell(currentOf("", ["Passport"]))}</Td>
                <Td>{statusCell(currentOf("", [...RIGHT_TO_WORK_TYPES, "Visa"]))}</Td>
              </Tr>
              {household.map((dependant) => (
                <Tr key={dependant.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{dependant.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {[dependant.relationship, dependant.nationality].filter(Boolean).join(" · ")}
                    </p>
                  </Td>
                  <Td className="hidden md:table-cell">{sensitive(formatDate(dependant.dateOfBirth))}</Td>
                  <Td>{statusCell(currentOf(dependant.id, ["Passport"]))}</Td>
                  <Td>{statusCell(currentOf(dependant.id, ["Visa", "Residence permit", "Work permit", "Temporary employment permit"]))}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
        {household.map((dependant) => {
          const records = permitsOf(dependant.id);
          return (
            <div key={dependant.id} className="border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{dependant.fullName}</p>
                  {dependant.notes ? <p className="text-xs text-slate-500">{dependant.notes}</p> : null}
                </div>
                {mayEdit ? (
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                    <Link href={addPermitHref(expat.id, { dependant: dependant.id })} className="text-brand-700 hover:underline">
                      Add passport / visa / permit
                    </Link>
                    <Link href={`${base}/edit/dependant/${encodeURIComponent(dependant.id)}`} className="text-brand-700 hover:underline">
                      Edit
                    </Link>
                    <ArchiveDependantButton dependantId={dependant.id} name={dependant.fullName} archived={false} />
                  </div>
                ) : null}
              </div>
              {records.length ? (
                <PermitTable permits={records} restricted={restricted} mayEdit={mayEdit} />
              ) : (
                <p className="px-5 pb-4 text-sm text-slate-400">No documents recorded for {dependant.fullName} yet.</p>
              )}
            </div>
          );
        })}
        {former.length ? (
          <details className="border-t border-slate-100 px-5 py-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
              Former household members — {former.length}
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {former.map((dependant) => (
                <li key={dependant.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {dependant.fullName} <span className="text-xs text-slate-500">({dependant.relationship})</span>
                  </span>
                  {mayEdit ? <ArchiveDependantButton dependantId={dependant.id} name={dependant.fullName} archived /> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card id="accommodation" className="scroll-mt-24">
          <CardHeader
            icon={<BuildingIcon className="size-4" />}
            title="Accommodation"
            description="The current lease, and previous homes kept as history."
            action={
              mayEdit ? (
                <ButtonLink href={`${base}/add/lease`} size="sm" variant="secondary">
                  <PlusIcon />
                  Add lease
                </ButtonLink>
              ) : null
            }
          />
          <CardBody className="space-y-5">
            {currentLeases.length ? (
              currentLeases.map((lease) => (
                <div key={lease.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone={LEASE_STATUS_TONE[lease.status]}>{lease.status}</Badge>
                    {mayEdit ? (
                      <Link href={`${base}/edit/lease/${encodeURIComponent(lease.id)}`} className="text-xs font-medium text-brand-700 hover:underline">
                        Edit lease
                      </Link>
                    ) : null}
                  </div>
                  <DefinitionList
                    columns={2}
                    items={[
                      { label: "Property", value: sensitive(lease.address) },
                      {
                        label: "Landlord",
                        value: or(
                          <>
                            {lease.landlordName || "—"}
                            {!restricted && (lease.landlordPhone || lease.landlordEmail) ? (
                              <span className="block text-xs text-slate-500">{[lease.landlordPhone, lease.landlordEmail].filter(Boolean).join(" · ")}</span>
                            ) : null}
                          </>,
                        ),
                      },
                      { label: "Lease start", value: or(formatDate(lease.startDate)) },
                      { label: "Lease expiry", value: <ExpiryCell item={leaseExpiry(lease.id)} /> },
                      { label: "Notice / renewal date", value: or(formatDate(lease.noticeDate)) },
                      { label: "Monthly rent / deposit", value: restricted ? <Hidden /> : or([money(lease.monthlyRent, lease.currency), money(lease.deposit, lease.currency)].filter(Boolean).join(" / ")) },
                      ...(lease.notes ? [{ label: "Notes", value: lease.notes }] : []),
                    ]}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No current lease.</p>
            )}
            {pastLeases.length ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
                  Previous properties — {pastLeases.length}
                </summary>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {pastLeases.map((lease) => (
                    <li key={lease.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {restricted ? `Lease ${lease.id}` : lease.address}
                        <span className="block text-xs text-slate-500">
                          {formatDate(lease.startDate)} – {formatDate(lease.expiryDate)} · {lease.landlordName || "—"}
                        </span>
                      </span>
                      {mayEdit ? (
                        <Link href={`${base}/edit/lease/${encodeURIComponent(lease.id)}`} className="text-xs font-medium text-brand-700 hover:underline">
                          Edit
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardBody>
        </Card>

        <Card id="vehicles" className="scroll-mt-24">
          <CardHeader
            icon={<BuildingIcon className="size-4" />}
            title="Vehicles & insurance"
            description="Vehicles in use with their licence and cover. Driver's licence and medical cover are under Passport & immigration."
            action={
              mayEdit ? (
                <ButtonLink href={`${base}/add/vehicle`} size="sm" variant="secondary">
                  <PlusIcon />
                  Add vehicle
                </ButtonLink>
              ) : null
            }
          />
          <CardBody className="space-y-5">
            {vehiclesInUse.length ? (
              vehiclesInUse.map((vehicle) => (
                <div key={vehicle.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {vehicle.description} <span className="text-slate-500">{vehicle.registration}</span>
                    </p>
                    {mayEdit ? (
                      <Link href={`${base}/edit/vehicle/${encodeURIComponent(vehicle.id)}`} className="text-xs font-medium text-brand-700 hover:underline">
                        Edit vehicle
                      </Link>
                    ) : null}
                  </div>
                  <DefinitionList
                    columns={2}
                    items={[
                      { label: "Ownership", value: or(vehicle.ownership) },
                      { label: "Status", value: <Badge tone={VEHICLE_STATUS_TONE[vehicle.status]}>{vehicle.status}</Badge> },
                      { label: "Vehicle licence", value: <ExpiryCell item={vehicleExpiry(vehicle.id, "Vehicle licence")} /> },
                      { label: "Insurance", value: <ExpiryCell item={vehicleExpiry(vehicle.id, "Vehicle insurance")} /> },
                      { label: "Insurer / policy", value: or([vehicle.insurer, restricted ? "" : vehicle.policyNumber].filter(Boolean).join(" · ")) },
                      ...(vehicle.notes ? [{ label: "Notes", value: vehicle.notes }] : []),
                    ]}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No vehicle in use.</p>
            )}
            {pastVehicles.length ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:underline">
                  Previous vehicles — {pastVehicles.length}
                </summary>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {pastVehicles.map((vehicle) => (
                    <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {vehicle.description} {vehicle.registration}
                        <span className="block text-xs text-slate-500">
                          {vehicle.ownership} · {vehicle.status}
                        </span>
                      </span>
                      {mayEdit ? (
                        <Link href={`${base}/edit/vehicle/${encodeURIComponent(vehicle.id)}`} className="text-xs font-medium text-brand-700 hover:underline">
                          Edit
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card id="actions" className="scroll-mt-24">
        <CardHeader
          icon={<ClipboardIcon className="size-4" />}
          title="Follow-ups"
          description="Permit follow-ups, document requests, lease renewals — who has them and when they are due."
          action={
            mayManageActions ? (
              <ButtonLink href={`${base}/add/action`} size="sm" variant="secondary">
                <PlusIcon />
                Add follow-up
              </ButtonLink>
            ) : null
          }
        />
        <FollowUpList actions={actions} today={today} mayManage={mayManageActions} emptyDescription="Nothing is waiting on anyone for this expat." />
      </Card>

      <DocumentList
        row={row}
        timezone={config.timezone}
        today={today}
        restricted={restricted}
        mayAdd={mayEdit}
        mayRemove={canExpats(user, "removeExpatDocuments") && live}
        uploadsOn={uploadsOn}
      />

      <Card>
        <CardHeader title="Activity history" description="Every change to this profile: applications, renewals, uploads, lease changes and completed actions." />
        <CardBody className="p-0">
          {activity.length ? (
            <ul className="divide-y divide-slate-100">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {entry.action}
                      {entry.recordType !== "Expat" ? <span className="font-normal text-slate-500"> · {entry.recordType.toLowerCase()} {entry.recordId}</span> : null}
                    </p>
                    {entry.details ? <p className="text-xs break-words text-slate-500">{entry.details}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatTimestamp(entry.at, config.timezone)} · {entry.by || "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No changes recorded since this profile was added.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
