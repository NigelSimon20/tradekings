"use client";

import { type ReactNode } from "react";

import { saveBillboardAction } from "@/app/(billboards)/billboards/actions";
import { Field, Select } from "@/components/ui/field";
import {
  CoordinatesFields,
  FormError,
  FormFooter,
  FormSection,
  NotesField,
  Suggestions,
  TextField,
  fieldsSoFar,
  textOf,
  type TextFieldProps,
} from "@/components/forms/form-parts";
import { useRecordForm } from "@/components/forms/record-form";
import { BILLBOARD_STATUSES, BILLBOARD_TYPES, SITE_CONDITIONS, type Billboard } from "@/lib/billboards/types";

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

/**
 * Add or edit a billboard. Submitted through a transition so a validation
 * error leaves everything that was typed in place.
 */
export function BillboardForm({
  defaults,
  mode,
  cities,
}: {
  defaults: Partial<Billboard>;
  mode: "create" | "edit";
  /** Towns already in use, offered as suggestions so spellings stay consistent. */
  cities: string[];
}) {
  const { state, pending, onSubmit, form } = useRecordForm(saveBillboardAction, {
    reset: false,
    openSaved: (saved) => (saved.recordId ? `/billboards/${encodeURIComponent(saved.recordId)}` : null),
  });
  /** Road, area and town as typed so far — the map picker's first search. */
  const placeSoFar = () => fieldsSoFar(form.current, ["road", "area", "city"]) || fieldsSoFar(form.current, ["address"]);

  const error = (field: string) => state.errors[field];
  const text = (key: keyof Billboard) => textOf(defaults[key]);

  const input = (key: keyof Billboard, label: string, extra: Partial<TextFieldProps> = {}) => (
    <TextField name={key} label={label} error={error} defaultValue={defaults[key]} list={key === "city" ? "billboard-cities" : undefined} {...extra} />
  );

  const area = (key: keyof Billboard, label: string, hint?: string) => (
    <NotesField name={key} label={label} error={error} defaultValue={defaults[key]} rows={2} hint={hint} />
  );

  const section = (title: string, description: string, children: ReactNode) => (
    <FormSection title={title} description={description}>
      {children}
    </FormSection>
  );

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="existingId" value={mode === "edit" ? text("id") : ""} />
      <Suggestions id="billboard-cities" values={cities} />

      <FormError state={state} title="The billboard was not saved" />

      {section(
        "The site",
        "Where it is and what it is. Coordinates put it on the map.",
        <>
          {mode === "create"
            ? input("id", "Billboard ID", { hint: "Leave blank and the next number (BB-…) is used.", placeholder: "BB-…" })
            : null}
          {input("name", "Site name", { required: true, placeholder: "e.g. Samora Machel / Julius Nyerere" })}
          <Field label="Status" htmlFor="status" error={error("status")}>
            <Select id="status" name="status" defaultValue={text("status") || "Active"} options={options(BILLBOARD_STATUSES)} />
          </Field>
          <Field label="Billboard type" htmlFor="type" error={error("type")}>
            <Select
              id="type"
              name="type"
              defaultValue={text("type")}
              placeholder="Choose a type"
              options={options(BILLBOARD_TYPES)}
            />
          </Field>
          {input("dimensions", "Dimensions", { placeholder: "e.g. 12m x 4m" })}
          {input("faces", "Faces", { type: "number", placeholder: "e.g. 2" })}
          {input("address", "Address", { wide: true })}
          {input("city", "City / town", { required: true })}
          {input("area", "Area / suburb")}
          {input("road", "Road", { wide: true })}
          <CoordinatesFields error={error} defaults={defaults} suggestedSearch={placeSoFar} />
        </>,
      )}

      {section(
        "Lease",
        "The agreement for the site. Expiry dates drive the 30 and 90 day alerts.",
        <>
          {input("owner", "Owner", { wide: true })}
          {input("leaseStart", "Lease start", { type: "date" })}
          {input("leaseExpiry", "Lease expiry", { type: "date" })}
          {input("leaseCost", "Lease cost", { placeholder: "e.g. USD 1,200 / month" })}
          {input("noticePeriodDays", "Notice period (days)", {
            type: "number",
            hint: "Flags the site when the last day to give notice is near.",
          })}
          {area("renewalNotes", "Renewal / notice information")}
          {input("leaseDocumentUrl", "Lease agreement link", {
            type: "url",
            placeholder: "https://drive.google.com/…",
            wide: true,
          })}
        </>,
      )}

      {section(
        "Contacts",
        "Who to call about this site.",
        <>
          {input("landlordName", "Landlord / property manager")}
          {input("landlordPhone", "Landlord phone", { type: "tel" })}
          {input("landlordEmail", "Landlord email", { type: "email", wide: true })}
          {input("councilName", "Council / local authority contact")}
          {input("councilPhone", "Council phone", { type: "tel" })}
          {input("councilEmail", "Council email", { type: "email", wide: true })}
          {input("contractorName", "Maintenance / installation contractor")}
          {input("contractorPhone", "Contractor phone", { type: "tel" })}
          {input("contractorEmail", "Contractor email", { type: "email", wide: true })}
          {input("responsibleName", "Trade Kings responsible person")}
          {input("responsibleEmail", "Responsible person email", { type: "email" })}
        </>,
      )}

      {section(
        "Maintenance",
        "The site as it is now. Recording a maintenance visit on the profile updates these for you.",
        <>
          <Field label="Site condition" htmlFor="siteCondition" error={error("siteCondition")}>
            <Select
              id="siteCondition"
              name="siteCondition"
              defaultValue={text("siteCondition")}
              placeholder="Not recorded"
              options={options(SITE_CONDITIONS)}
            />
          </Field>
          <div />
          {input("lastInspection", "Last inspection", { type: "date" })}
          {input("nextInspection", "Next inspection", { type: "date" })}
          {area("maintenanceIssues", "Open maintenance issues", "Anything written here flags the site until it is cleared.")}
          {area("maintenanceNotes", "Maintenance notes")}
        </>,
      )}

      {section(
        "Follow-up and notes",
        "For anything the rules cannot see.",
        <>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="followUp"
              defaultChecked={Boolean(defaults.followUp)}
              className="size-4 rounded border-slate-300"
            />
            This site needs following up
          </label>
          {input("followUpNote", "What needs following up", { wide: true })}
          {area("notes", "Notes")}
        </>,
      )}

      <FormFooter pending={pending} submitLabel={mode === "create" ? "Add billboard" : "Save changes"} cancelHref={mode === "edit" ? `/billboards/${encodeURIComponent(text("id"))}` : "/billboards/list"} />
    </form>
  );
}
