"use client";

import { useActionState, useEffect, useRef, startTransition, type FormEvent, type ReactNode } from "react";

import {
  addCampaignAction,
  addFileAction,
  addMaintenanceAction,
  archiveBillboardAction,
  removeFileAction,
  setUpBillboardSheetAction,
} from "@/app/(billboards)/billboards/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PlusIcon, RefreshIcon } from "@/components/ui/icons";
import { EMPTY_BILLBOARD_FORM_STATE, type BillboardFormState } from "@/lib/billboards/form-state";
import { FILE_CATEGORIES, MAINTENANCE_KINDS, SITE_CONDITIONS } from "@/lib/billboards/types";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

type FormAction = (previous: BillboardFormState, formData: FormData) => Promise<BillboardFormState>;

/**
 * Runs a billboard action from a form. Submitting through a transition rather
 * than `<form action>` stops React clearing the fields when validation fails;
 * they are cleared only once the record has been saved.
 */
function useRecordForm(action: FormAction, confirmMessage?: string) {
  const [state, dispatch, pending] = useActionState(action, EMPTY_BILLBOARD_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return { state, pending, form, onSubmit, error: (field: string) => state.errors[field] };
}

function Result({ state }: { state: BillboardFormState }) {
  if (state.status === "idle") return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "critical"} className="mt-3">
      {state.message}
    </Alert>
  );
}

/** A collapsible "add a record" panel. Native `<details>`, so it needs no state. */
export function AddPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl ring-1 ring-slate-200 open:bg-slate-50/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <PlusIcon className="size-4 transition-transform group-open:rotate-45" />
        {label}
      </summary>
      <div className="border-t border-slate-200 px-4 py-4">{children}</div>
    </details>
  );
}

export function CampaignForm({ billboardId }: { billboardId: string }) {
  const { state, pending, form, onSubmit, error } = useRecordForm(addCampaignAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="billboardId" value={billboardId} />
      <Field label="Brand / product" htmlFor="brand" required error={error("brand")}>
        <Input id="brand" name="brand" placeholder="e.g. Boom" />
      </Field>
      <Field label="Campaign" htmlFor="campaign" error={error("campaign")}>
        <Input id="campaign" name="campaign" placeholder="e.g. Washing paste launch" />
      </Field>
      <Field label="Start date" htmlFor="startDate" required error={error("startDate")}>
        <Input id="startDate" name="startDate" type="date" />
      </Field>
      <Field label="End date" htmlFor="endDate" error={error("endDate")} hint="Leave blank if open-ended.">
        <Input id="endDate" name="endDate" type="date" />
      </Field>
      <Field label="Installed on" htmlFor="installedOn" error={error("installedOn")}>
        <Input id="installedOn" name="installedOn" type="date" />
      </Field>
      <Field label="Removed on" htmlFor="removedOn" error={error("removedOn")}>
        <Input id="removedOn" name="removedOn" type="date" />
      </Field>
      <Field
        label="Artwork link"
        htmlFor="artworkUrl"
        error={error("artworkUrl")}
        hint="A Google Drive or SharePoint link to the artwork."
        className="sm:col-span-2"
      >
        <Input id="artworkUrl" name="artworkUrl" type="url" placeholder="https://" />
      </Field>
      <Field label="Notes" htmlFor="campaignNotes" className="sm:col-span-2">
        <Textarea id="campaignNotes" name="notes" rows={2} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record campaign"}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function MaintenanceForm({ billboardId }: { billboardId: string }) {
  const { state, pending, form, onSubmit, error } = useRecordForm(addMaintenanceAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="billboardId" value={billboardId} />
      <Field label="Date" htmlFor="maintenanceDate" required error={error("date")}>
        <Input id="maintenanceDate" name="date" type="date" />
      </Field>
      <Field label="Type" htmlFor="kind" required error={error("kind")}>
        <Select
          id="kind"
          name="kind"
          defaultValue="Inspection"
          options={MAINTENANCE_KINDS.map((kind) => ({ value: kind, label: kind }))}
        />
      </Field>
      <Field
        label="Condition found"
        htmlFor="condition"
        error={error("condition")}
        hint="Updates the site's condition."
      >
        <Select
          id="condition"
          name="condition"
          placeholder="Not assessed"
          options={SITE_CONDITIONS.map((condition) => ({ value: condition, label: condition }))}
        />
      </Field>
      <Field
        label="Next inspection"
        htmlFor="nextInspectionDate"
        error={error("nextInspection")}
        hint="Updates the site's next inspection date."
      >
        <Input id="nextInspectionDate" name="nextInspection" type="date" />
      </Field>
      <Field
        label="What was found or done"
        htmlFor="description"
        required
        error={error("description")}
        className="sm:col-span-2"
      >
        <Textarea id="description" name="description" rows={3} />
      </Field>
      <Field label="Photo link" htmlFor="photoUrl" error={error("photoUrl")} className="sm:col-span-2">
        <Input id="photoUrl" name="photoUrl" type="url" placeholder="https://" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record maintenance"}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function FileForm({ billboardId }: { billboardId: string }) {
  const { state, pending, form, onSubmit, error } = useRecordForm(addFileAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="billboardId" value={billboardId} />
      <Field label="Category" htmlFor="category" required error={error("category")}>
        <Select
          id="category"
          name="category"
          options={FILE_CATEGORIES.map((category) => ({ value: category, label: category }))}
        />
      </Field>
      <Field label="Date on the document" htmlFor="documentDate" error={error("documentDate")}>
        <Input id="documentDate" name="documentDate" type="date" />
      </Field>
      <Field label="Title" htmlFor="fileTitle" required error={error("title")} className="sm:col-span-2">
        <Input id="fileTitle" name="title" placeholder="e.g. Signed lease 2026–2028" />
      </Field>
      <Field
        label="Link"
        htmlFor="fileUrl"
        required
        error={error("url")}
        hint="Upload the file to the shared Google Drive folder, then paste its share link here."
        className="sm:col-span-2"
      >
        <Input id="fileUrl" name="url" type="url" placeholder="https://drive.google.com/…" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add document"}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RemoveFileButton({ fileId, title }: { fileId: string; title: string }) {
  const { state, pending, onSubmit } = useRecordForm(
    removeFileAction,
    `Remove “${title}” from this billboard? The record stays in the sheet.`,
  );
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="fileId" value={fileId} />
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.status === "error" ? <p className={cn("text-xs", TONE_CLASSES.critical.text)}>{state.message}</p> : null}
    </form>
  );
}

export function ArchiveButton({ billboardId, archived }: { billboardId: string; archived: boolean }) {
  const { state, pending, onSubmit } = useRecordForm(
    archiveBillboardAction,
    archived
      ? undefined
      : "Archive this billboard? It leaves the map and dashboard, but its history is kept and it can be restored.",
  );
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="billboardId" value={billboardId} />
      <input type="hidden" name="archive" value={archived ? "0" : "1"} />
      <Button type="submit" variant={archived ? "secondary" : "ghost"} size="sm" disabled={pending}>
        {pending ? "Saving…" : archived ? "Restore billboard" : "Archive billboard"}
      </Button>
      {state.status === "error" ? <p className={cn("mt-1 text-xs", TONE_CLASSES.critical.text)}>{state.message}</p> : null}
    </form>
  );
}

export function SetUpBillboardSheetButton() {
  const [state, dispatch, pending] = useActionState(setUpBillboardSheetAction, EMPTY_BILLBOARD_FORM_STATE);
  return (
    <div>
      <Button type="button" onClick={() => startTransition(() => dispatch())} disabled={pending}>
        <RefreshIcon className="size-4" />
        {pending ? "Preparing…" : "Prepare the billboard sheet"}
      </Button>
      <Result state={state} />
    </div>
  );
}
