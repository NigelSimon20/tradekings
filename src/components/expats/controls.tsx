"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

import {
  addDocumentLinkAction,
  archiveDependantAction,
  disconnectExpatDriveAction,
  removeDocumentAction,
  restoreExpatAction,
  saveReminderSettingsAction,
  setDocumentHistoricalAction,
  setFollowUpStatusAction,
  setUpExpatSheetAction,
} from "@/app/(expats)/expats/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, type SelectOption } from "@/components/ui/field";
import { RefreshIcon, SendIcon } from "@/components/ui/icons";
import { EMPTY_EXPAT_FORM_STATE, type ExpatFormState } from "@/lib/expats/form-state";
import { DOCUMENT_CATEGORIES, type ActionStatus } from "@/lib/expats/types";
import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { postJson, useApiAction } from "@/lib/ui/use-api-action";

type FormAction = (previous: ExpatFormState, formData: FormData) => Promise<ExpatFormState>;

/** Runs an action from a small form, with an optional "are you sure?". Clears the form once saved. */
function useSmallForm(action: FormAction, confirmMessage?: string) {
  const [state, dispatch, pending] = useActionState(action, EMPTY_EXPAT_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    // The button pressed carries a value too (e.g. which status to move to).
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(data));
  };
  return { state, pending, form, onSubmit, error: (field: string) => state.errors[field] };
}

function Result({ state }: { state: ExpatFormState }) {
  if (state.status === "idle") return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "critical"} className="mt-3">
      {state.message}
    </Alert>
  );
}

function InlineError({ state }: { state: ExpatFormState }) {
  return state.status === "error" ? <p className={cn("mt-1 text-xs", TONE_CLASSES.critical.text)}>{state.message}</p> : null;
}

const categoryOptions = DOCUMENT_CATEGORIES.map((category) => ({ value: category, label: category }));

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

export function DocumentLinkForm({
  expatId,
  people,
  records,
}: {
  expatId: string;
  people: SelectOption[];
  records: SelectOption[];
}) {
  const { state, pending, form, onSubmit, error } = useSmallForm(addDocumentLinkAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="expatId" value={expatId} />
      <DocumentTargetFields people={people} records={records} idPrefix="link" />
      <Field label="Document type" htmlFor="linkCategory" required error={error("category")}>
        <Select id="linkCategory" name="category" options={categoryOptions} />
      </Field>
      <Field label="Expiry date" htmlFor="linkExpiry" error={error("expiryDate")} hint="If the document itself expires.">
        <Input id="linkExpiry" name="expiryDate" type="date" />
      </Field>
      <Field label="Title" htmlFor="linkTitle" required error={error("title")} className="sm:col-span-2">
        <Input id="linkTitle" name="title" placeholder="e.g. Signed employment contract 2026" />
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

function TextButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function RemoveDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  const { state, pending, onSubmit } = useSmallForm(
    removeDocumentAction,
    `Remove “${title}”? It is hidden here; the record stays in the sheet.`,
  );
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="documentId" value={documentId} />
      <TextButton pending={pending}>Remove</TextButton>
      <InlineError state={state} />
    </form>
  );
}

export function HistoricalToggle({ documentId, historical }: { documentId: string; historical: boolean }) {
  const { state, pending, onSubmit } = useSmallForm(setDocumentHistoricalAction);
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="historical" value={historical ? "0" : "1"} />
      <TextButton pending={pending}>{historical ? "Mark current" : "Move to history"}</TextButton>
      <InlineError state={state} />
    </form>
  );
}

export function FollowUpStatusButtons({ actionId, status }: { actionId: string; status: ActionStatus }) {
  const { state, pending, onSubmit } = useSmallForm(setFollowUpStatusAction);
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
  const { state, pending, onSubmit } = useSmallForm(
    archiveDependantAction,
    archived ? undefined : `Mark ${name} as no longer in the household? Their records are kept as history.`,
  );
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="dependantId" value={dependantId} />
      <input type="hidden" name="archive" value={archived ? "0" : "1"} />
      <TextButton pending={pending}>{archived ? "Back in household" : "Left household"}</TextButton>
      <InlineError state={state} />
    </form>
  );
}

export function RestoreExpatButton({ expatId }: { expatId: string }) {
  const { state, pending, onSubmit } = useSmallForm(restoreExpatAction, "Restore this expat to the active list?");
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="expatId" value={expatId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Restoring…" : "Restore to active"}
      </Button>
      <InlineError state={state} />
    </form>
  );
}

export function SetUpExpatSheetButton() {
  const [state, dispatch, pending] = useActionState(setUpExpatSheetAction, EMPTY_EXPAT_FORM_STATE);
  return (
    <div>
      <Button type="button" onClick={() => startTransition(() => dispatch())} disabled={pending}>
        <RefreshIcon className="size-4" />
        {pending ? "Preparing…" : "Prepare the expat sheet"}
      </Button>
      <Result state={state} />
    </div>
  );
}

export function DisconnectExpatDriveButton() {
  const [state, dispatch, pending] = useActionState(disconnectExpatDriveAction, EMPTY_EXPAT_FORM_STATE);
  const disconnect = () => {
    if (!window.confirm("Stop storing expat documents in this Google account? Files already uploaded stay in its Drive.")) return;
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

export function ReminderSettingsForm({ days, recipients }: { days: number[]; recipients: string[] }) {
  const { state, pending, onSubmit, error } = useSmallForm(saveReminderSettingsAction);
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
        <Result state={state} />
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
