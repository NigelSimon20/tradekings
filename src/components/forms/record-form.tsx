"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EMPTY_RECORD_FORM_STATE, type RecordAction, type RecordFormState } from "@/lib/domain/form-state";
import { cn } from "@/lib/ui/cn";
import { TONE_CLASSES } from "@/lib/ui/tones";

/**
 * Runs a server action from a form. Submitting through a transition rather
 * than `<form action>` stops React clearing the fields when validation fails;
 * they are cleared only once the record has been saved. The button pressed is
 * sent too, so one form can offer several (e.g. "Start" and "Mark done").
 */
export function useRecordForm(
  action: RecordAction,
  options: {
    confirmMessage?: string;
    /** Clear the fields once saved (the default for "add another" forms). */
    reset?: boolean;
    /** Where to go once saved, e.g. the new record's page. */
    openSaved?: (state: RecordFormState) => string | null | undefined;
  } = {},
) {
  const { confirmMessage, reset = true, openSaved } = options;
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(action, EMPTY_RECORD_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);
  // Read through a ref so a new function each render does not re-run the effect.
  const open = useRef(openSaved);
  useEffect(() => {
    open.current = openSaved;
  });

  useEffect(() => {
    if (state.status !== "success") return;
    const next = open.current?.(state);
    if (next) router.push(next);
    else if (reset) form.current?.reset();
  }, [state, reset, router]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(data));
  };

  return { state, pending, form, onSubmit, error: (field: string) => state.errors[field] };
}

/** What happened, under a form. */
export function FormResult({ state }: { state: RecordFormState }) {
  if (state.status === "idle") return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "critical"} className="mt-3">
      {state.message}
    </Alert>
  );
}

/** A failure, in a line of small text — for the small text buttons. */
export function InlineError({ state }: { state: RecordFormState }) {
  return state.status === "error" ? <p className={cn("mt-1 text-xs", TONE_CLASSES.critical.text)}>{state.message}</p> : null;
}

/**
 * One button that runs one server action: "Prepare the sheet", "Disconnect",
 * "Archive", "Remove"… `fields` are sent with it; `confirm` asks first.
 * `look="link"` is the small grey text style used inside lists.
 */
export function ActionButton({
  action,
  label,
  busyLabel = "Saving…",
  fields = {},
  confirm,
  icon,
  variant = "secondary",
  size = "sm",
  look = "button",
  showResult = look === "button",
}: {
  action: RecordAction;
  label: string;
  busyLabel?: string;
  fields?: Record<string, string>;
  confirm?: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  look?: "button" | "link";
  /** Show the success message too, not only failures. */
  showResult?: boolean;
}) {
  const { state, pending, onSubmit } = useRecordForm(action, { confirmMessage: confirm, reset: false });
  return (
    <form onSubmit={onSubmit}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {look === "link" ? (
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline disabled:opacity-50"
        >
          {pending ? busyLabel : label}
        </button>
      ) : (
        <Button type="submit" variant={variant} size={size} disabled={pending}>
          {icon}
          {pending ? busyLabel : label}
        </Button>
      )}
      {showResult ? <FormResult state={state} /> : <InlineError state={state} />}
    </form>
  );
}
