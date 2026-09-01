"use client";

import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const initialState: UpdatePasswordState = { error: null };

export default function PasswortAendernForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <>
      <h1 className="text-display font-semibold">Neues Passwort</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Neues Passwort
          <Input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? "Wird gespeichert…" : "Passwort speichern"}
        </Button>
      </form>
    </>
  );
}
