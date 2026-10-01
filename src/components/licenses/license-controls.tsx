"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

import {
  addDocumentLinkAction,
  archiveAssetAction,
  archiveLicenseAction,
  disconnectLicenseDriveAction,
  removeLicenseDocumentAction,
  saveReminderDaysAction,
  setUpLicenseSheetAction,
} from "@/app/(licenses)/licenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { RefreshIcon, UploadIcon } from "@/components/ui/icons";
import { EMPTY_LICENSE_FORM_STATE, type LicenseFormState } from "@/lib/licenses/form-state";
import { DOCUMENT_CATEGORIES } from "@/lib/licenses/types";
import { postForm, useApiAction } from "@/lib/ui/use-api-action";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

type FormAction = (previous: LicenseFormState, formData: FormData) => Promise<LicenseFormState>;

/**
 * Runs a License Tracker action from a form. Submitting through a transition
 * rather than `<form action>` keeps the fields when validation fails; they are
 * cleared only once the record has been saved.
 */
function useRecordForm(action: FormAction, confirmMessage?: string) {
  const [state, dispatch, pending] = useActionState(action, EMPTY_LICENSE_FORM_STATE);
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

function Result({ state }: { state: LicenseFormState }) {
  if (state.status === "idle") return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "critical"} className="mt-3">
      {state.message}
    </Alert>
  );
}

const categoryOptions = DOCUMENT_CATEGORIES.map((category) => ({ value: category, label: category }));

export function DocumentLinkForm({ licenseId, assetId }: { licenseId: string; assetId: string }) {
  const { state, pending, form, onSubmit, error } = useRecordForm(addDocumentLinkAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="licenseId" value={licenseId} />
      <input type="hidden" name="assetId" value={assetId} />
      <Field label="Category" htmlFor="linkCategory" required error={error("category")}>
        <Select id="linkCategory" name="category" options={categoryOptions} />
      </Field>
      <Field label="Date on the document" htmlFor="linkDate" error={error("documentDate")}>
        <Input id="linkDate" name="documentDate" type="date" />
      </Field>
      <Field label="Title" htmlFor="linkTitle" required error={error("title")} className="sm:col-span-2">
        <Input id="linkTitle" name="title" placeholder="e.g. Fire certificate 2026" />
      </Field>
      <Field label="Link" htmlFor="linkUrl" required error={error("url")} className="sm:col-span-2">
        <Input id="linkUrl" name="url" type="url" placeholder="https://drive.google.com/…" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add link"}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function RemoveDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  const { state, pending, onSubmit } = useRecordForm(
    removeLicenseDocumentAction,
    `Remove “${title}”? It is hidden here; the record stays in the sheet.`,
  );
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="documentId" value={documentId} />
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

export function ArchiveButton({
  kind,
  recordId,
  archived,
}: {
  kind: "license" | "asset";
  recordId: string;
  archived: boolean;
}) {
  const { state, pending, onSubmit } = useRecordForm(
    kind === "license" ? archiveLicenseAction : archiveAssetAction,
    archived
      ? undefined
      : kind === "license"
        ? "Archive this license? It leaves the register and dashboard; its history is kept and it can be restored."
        : "Archive this asset? It leaves the map and lists; its licenses and history are kept and it can be restored.",
  );
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="archive" value={archived ? "0" : "1"} />
      <Button type="submit" variant={archived ? "secondary" : "ghost"} size="sm" disabled={pending}>
        {pending ? "Saving…" : archived ? `Restore ${kind}` : `Archive ${kind}`}
      </Button>
      {state.status === "error" ? <p className={cn("mt-1 text-xs", TONE_CLASSES.critical.text)}>{state.message}</p> : null}
    </form>
  );
}

export function SetUpLicenseSheetButton() {
  const [state, dispatch, pending] = useActionState(setUpLicenseSheetAction, EMPTY_LICENSE_FORM_STATE);
  return (
    <div>
      <Button type="button" onClick={() => startTransition(() => dispatch())} disabled={pending}>
        <RefreshIcon className="size-4" />
        {pending ? "Preparing…" : "Prepare the license sheet"}
      </Button>
      <Result state={state} />
    </div>
  );
}

export function DisconnectLicenseDriveButton() {
  const [state, dispatch, pending] = useActionState(disconnectLicenseDriveAction, EMPTY_LICENSE_FORM_STATE);
  const disconnect = () => {
    if (!window.confirm("Stop storing license documents in this Google account? Files already uploaded stay in its Drive.")) return;
    startTransition(() => dispatch());
  };
  return (
    <div>
      <Button type="button" variant="secondary" size="sm" onClick={disconnect} disabled={pending}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      <Result state={state} />
    </div>
  );
}

export function ReminderDaysForm({ current }: { current: number[] }) {
  const [state, dispatch, pending] = useActionState(saveReminderDaysAction, EMPTY_LICENSE_FORM_STATE);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        label="Remind this many days before expiry"
        htmlFor="reminderDays"
        hint="Separate with commas, e.g. 90, 60, 30, 7. Leave blank to go back to the defaults."
      >
        <Input id="reminderDays" name="reminderDays" defaultValue={current.join(", ")} className="max-w-xs" />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save reminder days"}
      </Button>
      <Result state={state} />
    </form>
  );
}

/**
 * Records a renewal, optionally with the renewed certificate. Posted as a form
 * upload because a scanned certificate is larger than a server action accepts.
 */
export function RenewalForm({
  licenseId,
  currentExpiry,
  suggestedExpiry,
}: {
  licenseId: string;
  currentExpiry: string | null;
  /** The current expiry plus one renewal period, as a starting point. */
  suggestedExpiry: string | null;
}) {
  const { busy, result, run } = useApiAction();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const outcome = await run("renew", () => postForm("/api/licenses/renewals", data));
    if (outcome) form.reset();
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="licenseId" value={licenseId} />
      <Field label="Renewed on" htmlFor="renewedOn" required>
        <Input id="renewedOn" name="renewedOn" type="date" required />
      </Field>
      <Field label="New certificate number" htmlFor="newNumber" hint="Leave blank if it has not changed.">
        <Input id="newNumber" name="newNumber" />
      </Field>
      <Field label="New issue date" htmlFor="newIssueDate">
        <Input id="newIssueDate" name="newIssueDate" type="date" defaultValue={currentExpiry ?? ""} />
      </Field>
      <Field label="New expiry date" htmlFor="newExpiry" hint="Reminders restart from this date.">
        <Input id="newExpiry" name="newExpiry" type="date" defaultValue={suggestedExpiry ?? ""} />
      </Field>
      <Field label="Renewed certificate" htmlFor="renewalFile" hint="PDF or photo, up to 4 MB." className="sm:col-span-2">
        <Input
          id="renewalFile"
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-800"
        />
      </Field>
      <Field label="Notes" htmlFor="renewalNotes" className="sm:col-span-2">
        <Textarea id="renewalNotes" name="notes" rows={2} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy !== null}>
          <UploadIcon className="size-4" />
          {busy ? "Saving…" : "Record renewal"}
        </Button>
        {result ? (
          <Alert tone={result.tone} className="mt-3">
            {result.text}
          </Alert>
        ) : null}
      </div>
    </form>
  );
}
