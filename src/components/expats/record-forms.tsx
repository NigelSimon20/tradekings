"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, type FormEvent, type ReactNode } from "react";

import {
  offboardExpatAction,
  saveDependantAction,
  saveExpatAction,
  saveFollowUpAction,
  saveLeaseAction,
  savePermitAction,
  saveVehicleAction,
} from "@/app/(expats)/expats/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea, type SelectOption } from "@/components/ui/field";
import { EMPTY_EXPAT_FORM_STATE, type ExpatFormState } from "@/lib/expats/form-state";
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

type Action = (previous: ExpatFormState, formData: FormData) => Promise<ExpatFormState>;
type ErrorOf = (field: string) => string | undefined;

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

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
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(action, EMPTY_EXPAT_FORM_STATE);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) router.push(state.redirectTo);
  }, [state, router]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.status === "error" ? (
        <Alert tone="critical" title="Not saved">
          {state.message}
        </Alert>
      ) : null}
      {children((field) => state.errors[field])}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || (state.status === "success" && Boolean(state.redirectTo))}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
    </Card>
  );
}

const valueOf = (value: unknown) => (value === null || value === undefined ? "" : String(value));

/**
 * One input. A sensitive field shown to someone who may not see it is greyed
 * out and empty; the server keeps whatever is stored.
 */
function TextField({
  name,
  label,
  error,
  defaultValue,
  type = "text",
  required,
  hint,
  wide,
  list,
  placeholder,
  hidden,
}: {
  name: string;
  label: string;
  error: ErrorOf;
  defaultValue?: unknown;
  type?: string;
  required?: boolean;
  hint?: ReactNode;
  wide?: boolean;
  list?: string;
  placeholder?: string;
  /** Sensitive, and this person may not see it. */
  hidden?: boolean;
}) {
  return (
    <Field
      label={label}
      htmlFor={name}
      required={required}
      error={error(name)}
      hint={hidden ? "Hidden — your role cannot see or change this." : hint}
      className={wide ? "sm:col-span-2" : undefined}
    >
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={hidden ? "" : valueOf(defaultValue)}
        disabled={hidden}
        placeholder={hidden ? "Hidden" : placeholder}
        list={list}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "any" : undefined}
      />
    </Field>
  );
}

function NotesField({ name = "notes", label = "Notes", error, defaultValue, rows = 3, hint }: {
  name?: string;
  label?: string;
  error: ErrorOf;
  defaultValue?: unknown;
  rows?: number;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={name} error={error(name)} hint={hint} className="sm:col-span-2">
      <Textarea id={name} name={name} rows={rows} defaultValue={valueOf(defaultValue)} />
    </Field>
  );
}

function SelectField({
  name,
  label,
  error,
  values,
  defaultValue,
  placeholder,
  hint,
  required,
}: {
  name: string;
  label: string;
  error: ErrorOf;
  values: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
}) {
  return (
    <Field label={label} htmlFor={name} error={error(name)} hint={hint} required={required}>
      <Select id={name} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} options={values} />
    </Field>
  );
}

function Suggestions({ id, values }: { id: string; values: readonly string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
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
      hidden={{ existingId: mode === "edit" ? valueOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add expat" : "Save changes"}
      cancelHref={cancel}
    >
      {(error) => (
        <>
          <Suggestions id="expat-nationalities" values={suggestions.nationalities} />
          <Suggestions id="expat-departments" values={suggestions.departments} />
          <Suggestions id="expat-positions" values={suggestions.positions} />
          <Suggestions id="expat-managers" values={suggestions.managers} />
          <Section title="Personal details" description="Who they are and how to reach them.">
            <TextField name="fullName" label="Full name" required wide error={error} defaultValue={defaults.fullName} placeholder="As on the passport" />
            <TextField name="employeeNumber" label="Employee number" error={error} defaultValue={defaults.employeeNumber} />
            <TextField name="nationality" label="Nationality" required list="expat-nationalities" error={error} defaultValue={defaults.nationality} />
            <TextField name="dateOfBirth" label="Date of birth" type="date" error={error} defaultValue={defaults.dateOfBirth} hidden={restricted} />
            <TextField name="phone" label="Phone" type="tel" error={error} defaultValue={defaults.phone} hidden={restricted} />
            <TextField name="email" label="Email" type="email" wide error={error} defaultValue={defaults.email} hidden={restricted} />
            <TextField name="residentialAddress" label="Residential address" wide error={error} defaultValue={defaults.residentialAddress} hidden={restricted} />
          </Section>
          <Section title="Emergency contact">
            <TextField name="emergencyName" label="Name" error={error} defaultValue={defaults.emergencyName} hidden={restricted} />
            <TextField name="emergencyRelationship" label="Relationship" error={error} defaultValue={defaults.emergencyRelationship} hidden={restricted} />
            <TextField name="emergencyPhone" label="Phone" type="tel" error={error} defaultValue={defaults.emergencyPhone} hidden={restricted} />
          </Section>
          <Section title="Employment" description="The contract end date is watched like any other expiry.">
            <SelectField name="company" label="Company" error={error} values={options(EXPAT_COMPANIES)} defaultValue={defaults.company ?? EXPAT_COMPANIES[0]} />
            <TextField name="department" label="Department" list="expat-departments" error={error} defaultValue={defaults.department} />
            <TextField name="position" label="Position" required list="expat-positions" error={error} defaultValue={defaults.position} />
            <SelectField
              name="employmentStatus"
              label="Employment status"
              error={error}
              values={options(EMPLOYMENT_STATUSES)}
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
          </Section>
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
      hidden={{ expatId, existingId: mode === "edit" ? valueOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add dependant" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#household`}
    >
      {(error) => (
        <Section title="Dependant" description="Their passport and visa or permit are added from the profile once they are saved.">
          <TextField name="fullName" label="Full name" required wide error={error} defaultValue={defaults.fullName} />
          <SelectField name="relationship" label="Relationship" required error={error} values={options(RELATIONSHIPS)} defaultValue={defaults.relationship ?? "Spouse"} />
          <TextField name="dateOfBirth" label="Date of birth" type="date" error={error} defaultValue={defaults.dateOfBirth} hidden={restricted} />
          <TextField name="nationality" label="Nationality" error={error} defaultValue={defaults.nationality} />
          <NotesField error={error} defaultValue={defaults.notes} hint="e.g. school, medical needs." />
        </Section>
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
      hidden={{ expatId, existingId: mode === "edit" ? valueOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Save" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#${section}`}
    >
      {(error) => (
        <>
          <Suggestions id="permit-types" values={PERMIT_TYPES} />
          <Section
            title="What it is"
            description="A passport, visa, permit, licence or medical cover — or an application for one."
          >
            <SelectField name="dependantId" label="Whose" error={error} values={people.slice(1)} placeholder={people[0]?.label} defaultValue={defaults.dependantId} />
            <TextField name="type" label="Type" required list="permit-types" error={error} defaultValue={defaults.type} hint="Pick one or type your own." />
            <SelectField
              name="status"
              label="Status"
              error={error}
              values={options(APPLICATION_STATUSES)}
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
          </Section>
          <Section title="The document" description="Fill in what is known; dates drive the reminders.">
            <TextField name="number" label="Number" error={error} defaultValue={defaults.number} hidden={restricted} />
            <TextField name="issuedBy" label="Issued by" error={error} defaultValue={defaults.issuedBy} placeholder="Country, authority or insurer" />
            <TextField name="issueDate" label="Issue date" type="date" error={error} defaultValue={defaults.issueDate} />
            <TextField name="expiryDate" label="Expiry date" type="date" error={error} defaultValue={defaults.expiryDate} />
          </Section>
          <Section title="Application" description="For anything not yet issued.">
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
          </Section>
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
      hidden={{ expatId, existingId: mode === "edit" ? valueOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add lease" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#accommodation`}
    >
      {(error) => (
        <>
          <Section title="Property and landlord">
            <TextField name="address" label="Property / address" required wide error={error} defaultValue={defaults.address} hidden={restricted} />
            <TextField name="landlordName" label="Landlord" error={error} defaultValue={defaults.landlordName} />
            <TextField name="landlordPhone" label="Landlord phone" type="tel" error={error} defaultValue={defaults.landlordPhone} hidden={restricted} />
            <TextField name="landlordEmail" label="Landlord email" type="email" wide error={error} defaultValue={defaults.landlordEmail} hidden={restricted} />
          </Section>
          <Section title="The lease" description="Set the status to Ended when they move out — the lease stays as history.">
            <TextField name="startDate" label="Lease start" type="date" error={error} defaultValue={defaults.startDate} />
            <TextField name="expiryDate" label="Lease expiry" type="date" error={error} defaultValue={defaults.expiryDate} />
            <TextField name="noticeDate" label="Notice / renewal date" type="date" error={error} defaultValue={defaults.noticeDate} hint="The last day to give notice or agree a renewal." />
            <SelectField name="status" label="Lease status" error={error} values={options(LEASE_STATUSES)} defaultValue={defaults.status ?? "Active"} />
            <TextField name="monthlyRent" label="Monthly rent" type="number" error={error} defaultValue={defaults.monthlyRent} hidden={restricted} />
            <TextField name="deposit" label="Deposit" type="number" error={error} defaultValue={defaults.deposit} hidden={restricted} />
            <TextField name="currency" label="Currency" error={error} defaultValue={defaults.currency ?? "USD"} />
            <NotesField error={error} defaultValue={defaults.notes} rows={2} />
          </Section>
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
      hidden={{ expatId, existingId: mode === "edit" ? valueOf(defaults.id) : "" }}
      submitLabel={mode === "create" ? "Add vehicle" : "Save changes"}
      cancelHref={`/expats/${encodeURIComponent(expatId)}#vehicles`}
    >
      {(error) => (
        <Section
          title="Vehicle"
          description="Set the status to Returned when it is handed back — the record stays as history. Driver's licences are added under Passports & permits."
        >
          <TextField name="description" label="Vehicle" required error={error} defaultValue={defaults.description} placeholder="e.g. Toyota Hilux" />
          <TextField name="registration" label="Registration" error={error} defaultValue={defaults.registration} />
          <SelectField name="ownership" label="Ownership" error={error} values={options(VEHICLE_OWNERSHIP)} defaultValue={defaults.ownership ?? VEHICLE_OWNERSHIP[0]} />
          <SelectField name="status" label="Status" error={error} values={options(VEHICLE_STATUSES)} defaultValue={defaults.status ?? "In use"} />
          <TextField name="licenceExpiry" label="Vehicle licence expiry" type="date" error={error} defaultValue={defaults.licenceExpiry} />
          <TextField name="insuranceExpiry" label="Insurance expiry" type="date" error={error} defaultValue={defaults.insuranceExpiry} />
          <TextField name="insurer" label="Insurer" error={error} defaultValue={defaults.insurer} />
          <TextField name="policyNumber" label="Policy number" error={error} defaultValue={defaults.policyNumber} hidden={restricted} />
          <NotesField error={error} defaultValue={defaults.notes} rows={2} />
        </Section>
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
        ...(expats ? {} : { expatId: valueOf(defaults.expatId) }),
        existingId: mode === "edit" ? valueOf(defaults.id) : "",
        returnTo: returnTo ?? "",
      }}
      submitLabel={mode === "create" ? "Add follow-up" : "Save changes"}
      cancelHref={cancel}
    >
      {(error) => (
        <>
          <Suggestions id="follow-up-people" values={people} />
          <Section title="Follow-up" description="A permit follow-up, a document request, a lease renewal — anything someone must do.">
            {expats ? (
              <SelectField name="expatId" label="For" required error={error} values={expats} placeholder="Choose an expat" defaultValue={defaults.expatId} />
            ) : null}
            <TextField name="title" label="What needs doing" required wide error={error} defaultValue={defaults.title} />
            <TextField name="responsibleName" label="Responsible person" list="follow-up-people" error={error} defaultValue={defaults.responsibleName} />
            <TextField name="responsibleEmail" label="Their email" type="email" error={error} defaultValue={defaults.responsibleEmail} />
            <TextField name="dueDate" label="Due date" type="date" error={error} defaultValue={defaults.dueDate} />
            <SelectField name="status" label="Status" error={error} values={options(ACTION_STATUSES)} defaultValue={defaults.status ?? "Open"} />
            <NotesField error={error} defaultValue={defaults.notes} />
          </Section>
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
          <Section title="Departure">
            <TextField name="departureDate" label="Departure date" type="date" required error={error} defaultValue={expat.departureDate} />
            <TextField
              name="departureReason"
              label="Reason"
              required
              error={error}
              defaultValue={expat.departureReason}
              placeholder="e.g. Contract ended — returned home"
            />
          </Section>
          <Section title="Handover" description="What happened to the permit, the home and the car.">
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
          </Section>
        </>
      )}
    </FormShell>
  );
}
