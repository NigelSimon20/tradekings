"use client";

import type { ReactNode } from "react";

import { useRecordForm, FormResult } from "@/components/forms/record-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { RecordAction } from "@/lib/domain/form-state";

/**
 * Adds a document by pasting its link (a file already in Drive, say) — for a
 * billboard, a license or asset, or an expat. The link is checked on the
 * server before it is saved.
 */
export function DocumentLinkForm({
  action,
  hidden,
  categories,
  dateField = { name: "documentDate", label: "Date on the document" },
  extraFields,
  titlePlaceholder,
  linkHint,
  submitLabel = "Add link",
}: {
  action: RecordAction;
  /** Which record it belongs to. */
  hidden: Record<string, string>;
  categories: readonly string[];
  dateField?: { name: string; label: string; hint?: string };
  /** More fields (e.g. whose document it is). */
  extraFields?: ReactNode;
  titlePlaceholder?: string;
  linkHint?: string;
  submitLabel?: string;
}) {
  const { state, pending, form, onSubmit, error } = useRecordForm(action);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {extraFields}
      <Field label="Category" htmlFor="linkCategory" required error={error("category")}>
        <Select id="linkCategory" name="category" options={categories.map((value) => ({ value, label: value }))} />
      </Field>
      <Field label={dateField.label} htmlFor="linkDate" error={error(dateField.name)} hint={dateField.hint}>
        <Input id="linkDate" name={dateField.name} type="date" />
      </Field>
      <Field label="Title" htmlFor="linkTitle" required error={error("title")} className="sm:col-span-2">
        <Input id="linkTitle" name="title" placeholder={titlePlaceholder} />
      </Field>
      <Field label="Link" htmlFor="linkUrl" required error={error("url")} hint={linkHint} className="sm:col-span-2">
        <Input id="linkUrl" name="url" type="url" placeholder="https://drive.google.com/…" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <FormResult state={state} />
      </div>
    </form>
  );
}
