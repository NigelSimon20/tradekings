"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { LocationPicker } from "@/components/billboards/location-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea, type SelectOption } from "@/components/ui/field";
import type { RecordFormState } from "@/lib/domain/form-state";

/**
 * The building blocks of every record form — billboards, assets, licenses,
 * expats and their records — so a field, a section and the Save / Cancel row
 * look and behave the same everywhere.
 */

/** The message for a field that failed validation. */
export type ErrorOf = (field: string) => string | undefined;

/** A stored value as an input's starting text. */
export const textOf = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

export const optionsOf = (values: readonly string[]): SelectOption[] => values.map((value) => ({ value, label: value }));

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
    </Card>
  );
}

export interface TextFieldProps {
  name: string;
  label: string;
  error: ErrorOf;
  defaultValue?: unknown;
  type?: string;
  required?: boolean;
  hint?: ReactNode;
  /** Spans both columns. */
  wide?: boolean;
  /** A `<datalist>` of suggestions. */
  list?: string;
  placeholder?: string;
  /** Sensitive, and this person may not see it: greyed out and empty; the server keeps what is stored. */
  hidden?: boolean;
}

export function TextField({ name, label, error, defaultValue, type = "text", required, hint, wide, list, placeholder, hidden }: TextFieldProps) {
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
        defaultValue={hidden ? "" : textOf(defaultValue)}
        disabled={hidden}
        placeholder={hidden ? "Hidden" : placeholder}
        list={list}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "any" : undefined}
      />
    </Field>
  );
}

export function NotesField({
  name = "notes",
  label = "Notes",
  error,
  defaultValue,
  rows = 3,
  hint,
}: {
  name?: string;
  label?: string;
  error: ErrorOf;
  defaultValue?: unknown;
  rows?: number;
  hint?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={name} error={error(name)} hint={hint} className="sm:col-span-2">
      <Textarea id={name} name={name} rows={rows} defaultValue={textOf(defaultValue)} />
    </Field>
  );
}

export function SelectField({
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
  values: SelectOption[];
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

/** Suggestions for a free-text field (`list="…"`), so spellings stay consistent. */
export function Suggestions({ id, values }: { id: string; values: readonly string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

export function FormError({ state, title = "Not saved" }: { state: RecordFormState; title?: string }) {
  return state.status === "error" ? (
    <Alert tone="critical" title={title}>
      {state.message}
    </Alert>
  ) : null;
}

export function FormFooter({ pending, submitLabel, cancelHref, done = false }: { pending: boolean; submitLabel: string; cancelHref: string; done?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending || done}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      <Link href={cancelHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
        Cancel
      </Link>
    </div>
  );
}

/**
 * Latitude and longitude, typed or picked on the map — the two stay in step.
 * `suggestedSearch` gives the map picker its first search (the address typed so far).
 */
export function CoordinatesFields({
  error,
  defaults,
  suggestedSearch,
}: {
  error: ErrorOf;
  defaults: { latitude?: number | null; longitude?: number | null };
  suggestedSearch: () => string;
}) {
  const [latitude, setLatitude] = useState(defaults.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(defaults.longitude?.toString() ?? "");
  const pinned =
    latitude.trim() && longitude.trim() && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;

  return (
    <>
      <Field label="Latitude" htmlFor="latitude" error={error("latitude")}>
        <Input id="latitude" name="latitude" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="-17.8292" />
      </Field>
      <Field label="Longitude" htmlFor="longitude" error={error("longitude")}>
        <Input id="longitude" name="longitude" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="31.0522" />
      </Field>
      <LocationPicker
        value={pinned}
        suggestedSearch={suggestedSearch}
        onPick={(point) => {
          setLatitude(String(point.latitude));
          setLongitude(String(point.longitude));
        }}
      />
    </>
  );
}

/** The text currently in some of a form's fields, joined — e.g. the address so far. */
export function fieldsSoFar(form: HTMLFormElement | null, names: string[]): string {
  const value = (name: string) => String((form?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();
  return names.map(value).filter(Boolean).join(", ");
}
