"use client";

import { useActionState } from "react";

import { signInAction, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

const INITIAL: LoginState = { error: "" };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Access password" htmlFor="password" error={state.error || undefined}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
