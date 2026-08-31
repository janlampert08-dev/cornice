"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthFormState } from "@/lib/actions/auth";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

const initialState: AuthFormState = { error: null };

export default function RegistrierenForm() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <>
      <h1 className="text-display font-semibold">Registrieren</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Name
          <Input
            type="text"
            name="display_name"
            required
            minLength={2}
            maxLength={50}
            autoComplete="name"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          E-Mail
          <Input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Passwort
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
          {pending ? "Registrieren…" : "Registrieren"}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Schon ein Konto?{" "}
        <Link href="/anmelden" className="font-medium text-accent hover:underline">
          Anmelden
        </Link>
      </p>
    </>
  );
}
