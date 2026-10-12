"use client";

import {
  archiveDependantAction,
  removeDocumentAction,
  restoreExpatAction,
  saveReminderSettingsAction,
  setDocumentHistoricalAction,
  setFollowUpStatusAction,
} from "@/app/(expats)/expats/actions";
import { ActionButton, FormResult, InlineError, useRecordForm } from "@/components/forms/record-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, type SelectOption } from "@/components/ui/field";
import { SendIcon } from "@/components/ui/icons";
import { type ActionStatus } from "@/lib/expats/types";
import { postJson, useApiAction } from "@/lib/ui/use-api-action";

/** Whose document it is and which record it supports — shared by uploads and links. */
export function DocumentTargetFields({
  people,
  records,
  idPrefix,
}: {
  people: SelectOption[];
  records: SelectOption[];
  /** Two of these can be on one page (upload and link). */
  idPrefix: string;
}) {
  return (
    <>
      <Field label="Whose document" htmlFor={`${idPrefix}Person`}>
        <Select id={`${idPrefix}Person`} name="dependantId" options={people.slice(1)} placeholder={people[0]?.label} />
      </Field>
      <Field label="Supports" htmlFor={`${idPrefix}Record`} hint="Link it to a permit, lease or vehicle so it moves to history with it.">
        <Select id={`${idPrefix}Record`} name="recordId" options={records} placeholder="Nothing in particular" />
      </Field>
    </>
  );
}

export function RemoveDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  return (
    <ActionButton
      action={removeDocumentAction}
      fields={{ documentId }}
      label="Remove"
      busyLabel="Removing…"
      look="link"
      confirm={`Remove “${title}”? It is hidden here; the record stays in the sheet.`}
    />
  );
}

export function HistoricalToggle({ documentId, historical }: { documentId: string; historical: boolean }) {
  return (
    <ActionButton
      action={setDocumentHistoricalAction}
      fields={{ documentId, historical: historical ? "0" : "1" }}
      label={historical ? "Mark current" : "Move to history"}
      look="link"
    />
  );
}

export function FollowUpStatusButtons({ actionId, status }: { actionId: string; status: ActionStatus }) {
  const { state, pending, onSubmit } = useRecordForm(setFollowUpStatusAction, { reset: false });
  const next: ActionStatus[] = status === "Open" ? ["In progress", "Done"] : status === "In progress" ? ["Done"] : ["Open"];
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="actionId" value={actionId} />
      {next.map((value) => (
        <Button key={value} type="submit" name="status" value={value} size="sm" variant={value === "Done" ? "primary" : "secondary"} disabled={pending}>
          {value === "Open" ? "Reopen" : value === "Done" ? "Mark done" : "Start"}
        </Button>
      ))}
      <InlineError state={state} />
    </form>
  );
}

export function ArchiveDependantButton({ dependantId, name, archived }: { dependantId: string; name: string; archived: boolean }) {
  return (
    <ActionButton
      action={archiveDependantAction}
      fields={{ dependantId, archive: archived ? "0" : "1" }}
      label={archived ? "Back in household" : "Left household"}
      look="link"
      confirm={archived ? undefined : `Mark ${name} as no longer in the household? Their records are kept as history.`}
    />
  );
}

export function RestoreExpatButton({ expatId }: { expatId: string }) {
  return (
    <ActionButton
      action={restoreExpatAction}
      fields={{ expatId }}
      label="Restore to active"
      busyLabel="Restoring…"
      showResult={false}
      confirm="Restore this expat to the active list?"
    />
  );
}

export function ReminderSettingsForm({ days, recipients }: { days: number[]; recipients: string[] }) {
  const { state, pending, onSubmit, error } = useRecordForm(saveReminderSettingsAction, { reset: false });
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Remind this many days before expiry"
        htmlFor="reminderDays"
        error={error("reminderDays")}
        hint="Separate with commas, e.g. 90, 60, 30, 7. Blank goes back to the defaults."
      >
        <Input id="reminderDays" name="reminderDays" defaultValue={days.join(", ")} />
      </Field>
      <Field
        label="Send every reminder to"
        htmlFor="recipients"
        error={error("recipients")}
        hint="HR email addresses, separated by commas. Each expat's responsible manager is also emailed about their own people."
        className="sm:col-span-2"
      >
        <Textarea id="recipients" name="recipients" rows={2} defaultValue={recipients.join(", ")} placeholder="hr@tradekings.co.zw" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save reminder settings"}
        </Button>
        <FormResult state={state} />
      </div>
    </form>
  );
}

export function SendRemindersButton({ due }: { due: number }) {
  const { busy, result, run } = useApiAction();
  return (
    <div>
      <Button
        type="button"
        variant={due ? "primary" : "secondary"}
        size="sm"
        disabled={busy !== null}
        onClick={() => run("send", () => postJson("/api/expats/reminders", {}))}
      >
        <SendIcon className="size-4" />
        {busy ? "Sending…" : due ? `Send ${due} due reminder${due === 1 ? "" : "s"} now` : "Check and send now"}
      </Button>
      {result ? (
        <Alert tone={result.tone} className="mt-3">
          {result.text}
        </Alert>
      ) : null}
    </div>
  );
}
