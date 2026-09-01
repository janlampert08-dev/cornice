"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthFormState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const initialState: AuthFormState = { error: null };

export default function PasswortVergessenForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <>
      <h1 className="text-display font-semibold">Passwort vergessen</h1>
      <p className="text-sm text-muted">
        Gib deine E-Mail-Adresse ein. Falls ein Konto dazu existiert, schicken wir dir einen
        Link zum Zurücksetzen.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          E-Mail
          <Input type="email" name="email" required autoComplete="email" />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="mt-1">
          {pending ? "Senden…" : "Link senden"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        <Link href="/anmelden" className="font-medium text-accent hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}
