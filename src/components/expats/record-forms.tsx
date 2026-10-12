"use client";

import { type ReactNode } from "react";

import {
  offboardExpatAction,
  saveDependantAction,
  saveExpatAction,
  saveFollowUpAction,
  saveLeaseAction,
  savePermitAction,
  saveVehicleAction,
} from "@/app/(expats)/expats/actions";
import { type SelectOption } from "@/components/ui/field";
import {
  FormError,
  FormFooter,
  FormSection,
  NotesField,
  SelectField,
  Suggestions,
  TextField,
  optionsOf,
  textOf,
  type ErrorOf,
} from "@/components/forms/form-parts";
import { useRecordForm } from "@/components/forms/record-form";
import type { RecordFormState } from "@/lib/domain/form-state";
import {
  ACTION_STATUSES,
  APPLICATION_STATUSES,
  EMPLOYMENT_STATUSES,
  EXPAT_COMPANIES,
  LEASE_STATUSES,
  PERMIT_TYPES,
  RELATIONSHIPS,
  VEHICLE_OWNERSHIP,
  VEHICLE_STATUSES,
  type Dependant,
  type Expat,
  type FollowUp,
  type Lease,
  type Permit,
  type Vehicle,
} from "@/lib/expats/types";

type Action = (previous: RecordFormState, formData: FormData) => Promise<RecordFormState>;

/**
 * Every expat form: submits through a transition (so fields survive a failed
 * validation), then goes to the page the action names — usually the profile,
 * at the section that changed.
 */
function FormShell({
  action,
  hidden,
  submitLabel,
  cancelHref,
  confirmMessage,
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  submitLabel: string;
  cancelHref: string;
  confirmMessage?: string;
  children: (error: ErrorOf) => ReactNode;
}) {
  const { state, pending, onSubmit } = useRecordForm(action, {
    confirmMessage,
    reset: false,
    openSaved: (saved) => saved.redirectTo,
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <FormError state={state} />
      {children((field) => state.errors[field])}
      <FormFooter pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} done={state.status === "success" && Boolean(state.redirectTo)} />
    </form>
  );
}

// ---------------------------------------------------------------------------

export function ExpatForm({
  mode,
  defaults,
  restricted,
  suggestions,
}: {
  mode: "create" | "edit";
  defaults: Partial<Expat>;
  restricted: boolean;
  suggestions: { nationalities: string[]; departments: string[]; positions: string[]; managers: string[] };
}) {
  const cancel = mode === "edit" && defaults.id ? `/expats/${encodeURIComponent(defaults.id)}` : "/expats/people";
  return (
    <FormShell
      action={saveExpatAction}
      hidden={{ existingId: mode === "edit" ? textOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add expat" : "Save changes"}
      cancelHref={cancel}
    >
      {(error) => (
        <>
          <Suggestions id="expat-nationalities" values={suggestions.nationalities} />
          <Suggestions id="expat-departments" values={suggestions.departments} />
          <Suggestions id="expat-positions" values={suggestions.positions} />
          <Suggestions id="expat-managers" values={suggestions.managers} />
          <FormSection title="Personal details" description="Who they are and how to reach them.">
            <TextField name="fullName" label="Full name" required wide error={error} defaultValue={defaults.fullName} placeholder="As on the passport" />
            <TextField name="employeeNumber" label="Employee number" error={error} defaultValue={defaults.employeeNumber} />
            <TextField name="nationality" label="Nationality" required list="expat-nationalities" error={error} defaultValue={defaults.nationality} />
            <TextField name="dateOfBirth" label="Date of birth" type="date" error={error} defaultValue={defaults.dateOfBirth} hidden={restricted} />
            <TextField name="phone" label="Phone" type="tel" error={error} defaultValue={defaults.phone} hidden={restricted} />
            <TextField name="email" label="Email" type="email" wide error={error} defaultValue={defaults.email} hidden={restricted} />
            <TextField name="residentialAddress" label="Residential address" wide error={error} defaultValue={defaults.residentialAddress} hidden={restricted} />
          </FormSection>
          <FormSection title="Emergency contact">
            <TextField name="emergencyName" label="Name" error={error} defaultValue={defaults.emergencyName} hidden={restricted} />
            <TextField name="emergencyRelationship" label="Relationship" error={error} defaultValue={defaults.emergencyRelationship} hidden={restricted} />
            <TextField name="emergencyPhone" label="Phone" type="tel" error={error} defaultValue={defaults.emergencyPhone} hidden={restricted} />
          </FormSection>
          <FormSection title="Employment" description="The contract end date is watched like any other expiry.">
            <SelectField name="company" label="Company" error={error} values={optionsOf(EXPAT_COMPANIES)} defaultValue={defaults.company ?? EXPAT_COMPANIES[0]} />
            <TextField name="department" label="Department" list="expat-departments" error={error} defaultValue={defaults.department} />
            <TextField name="position" label="Position" required list="expat-positions" error={error} defaultValue={defaults.position} />
            <SelectField
              name="employmentStatus"
              label="Employment status"
              error={error}
              values={optionsOf(EMPLOYMENT_STATUSES)}
              defaultValue={defaults.employmentStatus ?? "Active"}
              hint="Offboarding (leaving the company or country) is done from the profile."
            />
            <TextField name="managerName" label="Responsible manager" list="expat-managers" error={error} defaultValue={defaults.managerName} />
            <TextField name="managerEmail" label="Manager email" type="email" error={error} defaultValue={defaults.managerEmail} hint="Gets the reminder emails for this expat." />
            <TextField name="employmentStart" label="Employment / contract start" type="date" error={error} defaultValue={defaults.employmentStart} />
            <TextField name="contractEnd" label="Contract end" type="date" error={error} defaultValue={defaults.contractEnd} />
            {mode === "create" ? (
              <TextField name="id" label="Expat ID" error={error} hint="Leave blank and the next number (EXP-…) is used." />
            ) : null}
            <NotesField error={error} defaultValue={defaults.notes} />
          </FormSection>
        </>
      )}
    </FormShell>
  );
}

export function DependantForm({
  expatId,
  mode,
  defaults,
  restricted,
}: {
  expatId: string;
  mode: "create" | "edit";
  defaults: Partial<Dependant>;
  restricted: boolean;
}) {
  return (
    <FormShell
      action={saveDependantAction}
      hidden={{ expatId, existingId: mode === "edit" ? textOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add dependant" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#household`}
    >
      {(error) => (
        <FormSection title="Dependant" description="Their passport and visa or permit are added from the profile once they are saved.">
          <TextField name="fullName" label="Full name" required wide error={error} defaultValue={defaults.fullName} />
          <SelectField name="relationship" label="Relationship" required error={error} values={optionsOf(RELATIONSHIPS)} defaultValue={defaults.relationship ?? "Spouse"} />
          <TextField name="dateOfBirth" label="Date of birth" type="date" error={error} defaultValue={defaults.dateOfBirth} hidden={restricted} />
          <TextField name="nationality" label="Nationality" error={error} defaultValue={defaults.nationality} />
          <NotesField error={error} defaultValue={defaults.notes} hint="e.g. school, medical needs." />
        </FormSection>
      )}
    </FormShell>
  );
}

export function PermitForm({
  expatId,
  mode,
  defaults,
  restricted,
  people,
  renewable,
}: {
  expatId: string;
  mode: "create" | "edit";
  defaults: Partial<Permit>;
  restricted: boolean;
  /** The expat and each dependant: whose document this is. */
  people: SelectOption[];
  /** Records this one could renew. */
  renewable: SelectOption[];
}) {
  const section = defaults.dependantId ? "household" : "immigration";
  return (
    <FormShell
      action={savePermitAction}
      hidden={{ expatId, existingId: mode === "edit" ? textOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Save" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#${section}`}
    >
      {(error) => (
        <>
          <Suggestions id="permit-types" values={PERMIT_TYPES} />
          <FormSection
            title="What it is"
            description="A passport, visa, permit, licence or medical cover — or an application for one."
          >
            <SelectField name="dependantId" label="Whose" error={error} values={people.slice(1)} placeholder={people[0]?.label} defaultValue={defaults.dependantId} />
            <TextField name="type" label="Type" required list="permit-types" error={error} defaultValue={defaults.type} hint="Pick one or type your own." />
            <SelectField
              name="status"
              label="Status"
              error={error}
              values={optionsOf(APPLICATION_STATUSES)}
              defaultValue={defaults.status ?? "Issued"}
              hint="Issued means it is in hand. Earlier steps track an application."
            />
            {renewable.length ? (
              <SelectField
                name="replacesId"
                label="Renews"
                error={error}
                values={renewable}
                placeholder="Nothing — a new document"
                defaultValue={defaults.replacesId}
                hint="Once issued, the one it renews moves to history."
              />
            ) : (
              <input type="hidden" name="replacesId" value="" />
            )}
          </FormSection>
          <FormSection title="The document" description="Fill in what is known; dates drive the reminders.">
            <TextField name="number" label="Number" error={error} defaultValue={defaults.number} hidden={restricted} />
            <TextField name="issuedBy" label="Issued by" error={error} defaultValue={defaults.issuedBy} placeholder="Country, authority or insurer" />
            <TextField name="issueDate" label="Issue date" type="date" error={error} defaultValue={defaults.issueDate} />
            <TextField name="expiryDate" label="Expiry date" type="date" error={error} defaultValue={defaults.expiryDate} />
          </FormSection>
          <FormSection title="Application" description="For anything not yet issued.">
            <TextField name="reference" label="Application / file reference" error={error} defaultValue={defaults.reference} hidden={restricted} />
            <TextField name="submittedOn" label="Submitted on" type="date" error={error} defaultValue={defaults.submittedOn} />
            <NotesField
              name="outstandingDocuments"
              label="Outstanding supporting documents"
              error={error}
              defaultValue={defaults.outstandingDocuments}
              hint="One per line. Shown on the profile and dashboard until the application moves on."
            />
            <NotesField error={error} defaultValue={defaults.notes} rows={2} />
          </FormSection>
        </>
      )}
    </FormShell>
  );
}

export function LeaseForm({
  expatId,
  mode,
  defaults,
  restricted,
}: {
  expatId: string;
  mode: "create" | "edit";
  defaults: Partial<Lease>;
  restricted: boolean;
}) {
  return (
    <FormShell
      action={saveLeaseAction}
      hidden={{ expatId, existingId: mode === "edit" ? textOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add lease" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#accommodation`}
    >
      {(error) => (
        <>
          <FormSection title="Property and landlord">
            <TextField name="address" label="Property / address" required wide error={error} defaultValue={defaults.address} hidden={restricted} />
            <TextField name="landlordName" label="Landlord" error={error} defaultValue={defaults.landlordName} />
            <TextField name="landlordPhone" label="Landlord phone" type="tel" error={error} defaultValue={defaults.landlordPhone} hidden={restricted} />
            <TextField name="landlordEmail" label="Landlord email" type="email" wide error={error} defaultValue={defaults.landlordEmail} hidden={restricted} />
          </FormSection>
          <FormSection title="The lease" description="Set the status to Ended when they move out — the lease stays as history.">
            <TextField name="startDate" label="Lease start" type="date" error={error} defaultValue={defaults.startDate} />
            <TextField name="expiryDate" label="Lease expiry" type="date" error={error} defaultValue={defaults.expiryDate} />
            <TextField name="noticeDate" label="Notice / renewal date" type="date" error={error} defaultValue={defaults.noticeDate} hint="The last day to give notice or agree a renewal." />
            <SelectField name="status" label="Lease status" error={error} values={optionsOf(LEASE_STATUSES)} defaultValue={defaults.status ?? "Active"} />
            <TextField name="monthlyRent" label="Monthly rent" type="number" error={error} defaultValue={defaults.monthlyRent} hidden={restricted} />
            <TextField name="deposit" label="Deposit" type="number" error={error} defaultValue={defaults.deposit} hidden={restricted} />
            <TextField name="currency" label="Currency" error={error} defaultValue={defaults.currency ?? "USD"} />
            <NotesField error={error} defaultValue={defaults.notes} rows={2} />
          </FormSection>
        </>
      )}
    </FormShell>
  );
}

export function VehicleForm({
  expatId,
  mode,
  defaults,
  restricted,
}: {
  expatId: string;
  mode: "create" | "edit";
  defaults: Partial<Vehicle>;
  restricted: boolean;
}) {
  return (
    <FormShell
      action={saveVehicleAction}
      hidden={{ expatId, existingId: mode === "edit" ? textOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add vehicle" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#vehicles`}
    >
      {(error) => (
        <FormSection
          title="Vehicle"
          description="Set the status to Returned when it is handed back — the record stays as history. Driver's licences are added under Passports & permits."
        >
          <TextField name="description" label="Vehicle" required error={error} defaultValue={defaults.description} placeholder="e.g. Toyota Hilux" />
          <TextField name="registration" label="Registration" error={error} defaultValue={defaults.registration} />
          <SelectField name="ownership" label="Ownership" error={error} values={optionsOf(VEHICLE_OWNERSHIP)} defaultValue={defaults.ownership ?? VEHICLE_OWNERSHIP[0]} />
          <SelectField name="status" label="Status" error={error} values={optionsOf(VEHICLE_STATUSES)} defaultValue={defaults.status ?? "In use"} />
          <TextField name="licenceExpiry" label="Vehicle licence expiry" type="date" error={error} defaultValue={defaults.licenceExpiry} />
          <TextField name="insuranceExpiry" label="Insurance expiry" type="date" error={error} defaultValue={defaults.insuranceExpiry} />
          <TextField name="insurer" label="Insurer" error={error} defaultValue={defaults.insurer} />
          <TextField name="policyNumber" label="Policy number" error={error} defaultValue={defaults.policyNumber} hidden={restricted} />
          <NotesField error={error} defaultValue={defaults.notes} rows={2} />
        </FormSection>
      )}
    </FormShell>
  );
}

export function FollowUpForm({
  mode,
  defaults,
  expats,
  returnTo,
  people,
}: {
  mode: "create" | "edit";
  defaults: Partial<FollowUp>;
  /** To choose whose follow-up it is, when not opened from a profile. */
  expats?: SelectOption[];
  returnTo?: string;
  /** Names to suggest for the responsible person. */
  people: string[];
}) {
  const cancel = returnTo ?? (defaults.expatId ? `/expats/${encodeURIComponent(defaults.expatId)}#actions` : "/expats/actions");
  return (
    <FormShell
      action={saveFollowUpAction}
      hidden={{
        ...(expats ? {} : { expatId: textOf(defaults.expatId) }),
        existingId: mode === "edit" ? textOf(defaults.id) : "",
        returnTo: returnTo ?? "",
      }}
      submitLabel={mode === "create" ? "Add follow-up" : "Save changes"}
      cancelHref={cancel}
    >
      {(error) => (
        <>
          <Suggestions id="follow-up-people" values={people} />
          <FormSection title="Follow-up" description="A permit follow-up, a document request, a lease renewal — anything someone must do.">
            {expats ? (
              <SelectField name="expatId" label="For" required error={error} values={expats} placeholder="Choose an expat" defaultValue={defaults.expatId} />
            ) : null}
            <TextField name="title" label="What needs doing" required wide error={error} defaultValue={defaults.title} />
            <TextField name="responsibleName" label="Responsible person" list="follow-up-people" error={error} defaultValue={defaults.responsibleName} />
            <TextField name="responsibleEmail" label="Their email" type="email" error={error} defaultValue={defaults.responsibleEmail} />
            <TextField name="dueDate" label="Due date" type="date" error={error} defaultValue={defaults.dueDate} />
            <SelectField name="status" label="Status" error={error} values={optionsOf(ACTION_STATUSES)} defaultValue={defaults.status ?? "Open"} />
            <NotesField error={error} defaultValue={defaults.notes} />
          </FormSection>
        </>
      )}
    </FormShell>
  );
}

export function OffboardForm({ expat, openActions }: { expat: Expat; openActions: string }) {
  return (
    <FormShell
      action={offboardExpatAction}
      hidden={{ expatId: expat.id }}
      submitLabel="Offboard and archive"
      cancelHref={`/expats/${encodeURIComponent(expat.id)}`}
      confirmMessage={`Offboard ${expat.fullName}? The profile is archived — nothing is deleted, reminders stop, and it can be restored.`}
    >
      {(error) => (
        <>
          <FormSection title="Departure">
            <TextField name="departureDate" label="Departure date" type="date" required error={error} defaultValue={expat.departureDate} />
            <TextField
              name="departureReason"
              label="Reason"
              required
              error={error}
              defaultValue={expat.departureReason}
              placeholder="e.g. Contract ended — returned home"
            />
          </FormSection>
          <FormSection title="Handover" description="What happened to the permit, the home and the car.">
            <NotesField name="permitClosure" label="Permit closure / cancellation" error={error} defaultValue={expat.permitClosure} rows={2} />
            <NotesField name="propertyHandover" label="Property handover" error={error} defaultValue={expat.propertyHandover} rows={2} />
            <NotesField name="vehicleReturn" label="Vehicle return" error={error} defaultValue={expat.vehicleReturn} rows={2} />
            <NotesField
              name="outstandingActions"
              label="Outstanding actions"
              error={error}
              defaultValue={expat.outstandingActions || openActions}
              rows={3}
              hint="Filled in with the follow-ups still open. They stay on record."
            />
            <NotesField name="offboardingNotes" label="Final notes" error={error} defaultValue={expat.offboardingNotes} />
          </FormSection>
        </>
      )}
    </FormShell>
  );
}
