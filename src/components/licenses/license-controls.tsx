"use client";

import type { FormEvent } from "react";

import {
  archiveAssetAction,
  archiveLicenseAction,
  removeLicenseDocumentAction,
  saveReminderDaysAction,
} from "@/app/(licenses)/licenses/actions";
import { ActionButton, FormResult, useRecordForm } from "@/components/forms/record-form";
import { ReminderDaysPicker } from "@/components/forms/reminder-days-picker";
import { DEFAULT_LICENSE_RULES } from "@/lib/licenses/rules";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { UploadIcon } from "@/components/ui/icons";
import { postForm, useApiAction } from "@/lib/ui/use-api-action";

export function RemoveDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  return (
    <ActionButton
      action={removeLicenseDocumentAction}
      fields={{ documentId }}
      label="Remove"
      busyLabel="Removing…"
      look="link"
      confirm={`Remove “${title}”? It is hidden here; the record stays in the sheet.`}
    />
  );
}

export function ArchiveButton({ kind, recordId, archived }: { kind: "license" | "asset"; recordId: string; archived: boolean }) {
  return (
    <ActionButton
      action={kind === "license" ? archiveLicenseAction : archiveAssetAction}
      fields={{ recordId, archive: archived ? "0" : "1" }}
      label={archived ? `Restore ${kind}` : `Archive ${kind}`}
      variant={archived ? "secondary" : "ghost"}
      showResult={false}
      confirm={
        archived
          ? undefined
          : kind === "license"
            ? "Archive this license? It leaves the register and dashboard; its history is kept and it can be restored."
            : "Archive this asset? It leaves the map and lists; its licenses and history are kept and it can be restored."
      }
    />
  );
}

export function ReminderDaysForm({ current }: { current: number[] }) {
  const { state, pending, onSubmit } = useRecordForm(saveReminderDaysAction, { reset: false });
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Remind this long before expiry</legend>
        <ReminderDaysPicker initial={current} defaults={DEFAULT_LICENSE_RULES.reminderDays} />
      </fieldset>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save reminder days"}
      </Button>
      <FormResult state={state} />
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
