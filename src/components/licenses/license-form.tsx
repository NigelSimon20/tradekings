"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { saveLicenseAction } from "@/app/(licenses)/licenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EMPTY_LICENSE_FORM_STATE } from "@/lib/licenses/form-state";
import {
  RENEWAL_FREQUENCIES,
  RENEWAL_STATUSES,
  SUGGESTED_LICENSE_TYPES,
  type License,
} from "@/lib/licenses/types";

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
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(saveLicenseAction, EMPTY_LICENSE_FORM_STATE);
  const [category, setCategory] = useState(defaults.category ?? "");

  useEffect(() => {
    if (state.status === "success" && state.recordId) {
      router.push(`/licenses/${encodeURIComponent(state.recordId)}`);
    }
  }, [state, router]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  const error = (field: string) => state.errors[field];
  const text = (key: keyof License) => {
    const value = defaults[key];
    return value === null || value === undefined ? "" : String(value);
  };
  const suggestedTypes = [...new Set([...(SUGGESTED_LICENSE_TYPES[category] ?? []), ...typesInUse])];

  const input = (
    key: keyof License,
    label: string,
    extra: { type?: string; required?: boolean; hint?: ReactNode; placeholder?: string; wide?: boolean; list?: string } = {},
  ) => (
    <Field
      label={label}
      htmlFor={key}
      required={extra.required}
      error={error(key)}
      hint={extra.hint}
      className={extra.wide ? "sm:col-span-2" : undefined}
    >
      <Input
        id={key}
        name={key}
        type={extra.type ?? "text"}
        defaultValue={text(key)}
        placeholder={extra.placeholder}
        list={extra.list}
      />
    </Field>
  );

  const section = (title: string, description: string, children: ReactNode) => (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
    </Card>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="existingId" value={mode === "edit" ? text("id") : ""} />
      <datalist id="license-categories">
        {categories.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="license-types">
        {suggestedTypes.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="license-departments">
        {departments.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      {state.status === "error" ? (
        <Alert tone="critical" title="The license was not saved">
          {state.message}
        </Alert>
      ) : null}

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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add license" : "Save changes"}
        </Button>
        <Link
          href={mode === "edit" ? `/licenses/${encodeURIComponent(text("id"))}` : "/licenses/register"}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
