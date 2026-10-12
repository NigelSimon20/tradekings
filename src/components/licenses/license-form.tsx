"use client";

import { useState, type ReactNode } from "react";

import { saveLicenseAction } from "@/app/(licenses)/licenses/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  FormError,
  FormFooter,
  FormSection,
  Suggestions,
  TextField,
  textOf,
  type TextFieldProps,
} from "@/components/forms/form-parts";
import { useRecordForm } from "@/components/forms/record-form";
import { RENEWAL_FREQUENCIES, RENEWAL_STATUSES, SUGGESTED_LICENSE_TYPES, type License } from "@/lib/licenses/types";

const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));

/**
 * Add or edit a license. Category and type are free text with suggestions —
 * the brief's list plus whatever is already in use — so a new category needs
 * no change to the system.
 */
export function LicenseForm({
  defaults,
  mode,
  assets,
  categories,
  typesInUse,
  departments,
}: {
  defaults: Partial<License>;
  mode: "create" | "edit";
  assets: { id: string; label: string }[];
  categories: string[];
  typesInUse: string[];
  departments: string[];
}) {
  const { state, pending, onSubmit } = useRecordForm(saveLicenseAction, {
    reset: false,
    openSaved: (saved) => (saved.recordId ? `/licenses/${encodeURIComponent(saved.recordId)}` : null),
  });
  const [category, setCategory] = useState(defaults.category ?? "");

  const error = (field: string) => state.errors[field];
  const text = (key: keyof License) => textOf(defaults[key]);
  const suggestedTypes = [...new Set([...(SUGGESTED_LICENSE_TYPES[category] ?? []), ...typesInUse])];

  const input = (key: keyof License, label: string, extra: Partial<TextFieldProps> = {}) => (
    <TextField name={key} label={label} error={error} defaultValue={defaults[key]} {...extra} />
  );

  const section = (title: string, description: string, children: ReactNode) => (
    <FormSection title={title} description={description}>
      {children}
    </FormSection>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="existingId" value={mode === "edit" ? text("id") : ""} />
      <Suggestions id="license-categories" values={categories} />
      <Suggestions id="license-types" values={suggestedTypes} />
      <Suggestions id="license-departments" values={departments} />

      <FormError state={state} title="The license was not saved" />

      {section(
        "The license",
        "What it is, and what it belongs to.",
        <>
          {input("name", "License / permit name", { required: true, wide: true, placeholder: "e.g. Fire certificate — Msasa Warehouse" })}
          <Field label="Category" htmlFor="category" required error={error("category")} hint="Pick one or type a new category.">
            <Input
              id="category"
              name="category"
              list="license-categories"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </Field>
          {input("type", "License type", { required: true, list: "license-types", hint: "Pick one or type your own." })}
          {input("number", "License / certificate number")}
          <Field label="Asset or location" htmlFor="assetId" error={error("assetId")} hint="Blank for a company-wide license.">
            <Select
              id="assetId"
              name="assetId"
              defaultValue={text("assetId")}
              placeholder="Company-wide (no asset)"
              options={assets.map((asset) => ({ value: asset.id, label: asset.label }))}
            />
          </Field>
          {mode === "create" ? input("id", "License ID", { hint: "Leave blank and the next number (LIC-…) is used." }) : null}
        </>,
      )}

      {section(
        "Dates and renewal",
        "The expiry date drives the reminders and the dashboard.",
        <>
          {input("issuingAuthority", "Issuing authority", { wide: true })}
          {input("issueDate", "Issue date", { type: "date" })}
          {input("expiryDate", "Expiry date", { type: "date" })}
          <Field label="Renewal frequency" htmlFor="renewalFrequency" error={error("renewalFrequency")}>
            <Select id="renewalFrequency" name="renewalFrequency" defaultValue={text("renewalFrequency") || "Annual"} options={options(RENEWAL_FREQUENCIES)} />
          </Field>
          <Field label="Renewal status" htmlFor="renewalStatus" error={error("renewalStatus")} hint="Set to In progress or Submitted once a renewal is started.">
            <Select id="renewalStatus" name="renewalStatus" defaultValue={text("renewalStatus") || "Not started"} options={options(RENEWAL_STATUSES)} />
          </Field>
          {input("lastRenewalDate", "Last renewal date", { type: "date" })}
        </>,
      )}

      {section(
        "Responsibility and contacts",
        "Who renews it, and who to call.",
        <>
          {input("department", "Responsible department", { list: "license-departments" })}
          {input("responsibleName", "Responsible person")}
          {input("responsibleEmail", "Responsible person email", { type: "email", wide: true })}
          {input("contactName", "Contact at the authority")}
          {input("contactPhone", "Contact phone", { type: "tel" })}
          {input("contactEmail", "Contact email", { type: "email", wide: true })}
          <Field label="Notes or conditions" htmlFor="conditions" error={error("conditions")} className="sm:col-span-2">
            <Textarea id="conditions" name="conditions" rows={3} defaultValue={text("conditions")} />
          </Field>
        </>,
      )}

      <FormFooter pending={pending} submitLabel={mode === "create" ? "Add license" : "Save changes"} cancelHref={mode === "edit" ? `/licenses/${encodeURIComponent(text("id"))}` : "/licenses/register"} />
    </form>
  );
}
