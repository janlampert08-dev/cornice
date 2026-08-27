"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { error: null };

export default function RegistrierenPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <h1 className="text-xl font-semibold">Registrieren</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            type="text"
            name="display_name"
            required
            minLength={2}
            maxLength={50}
            className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          E-Mail
          <input
            type="email"
            name="email"
            required
            className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            name="password"
            required
            minLength={8}
            className="border border-[#131316]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE]"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="border border-[#131316] bg-[#131316] px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Registrieren…" : "Registrieren"}
        </button>
      </form>
      <p className="text-sm text-[#8A8F98]">
        Schon ein Konto?{" "}
        <Link href="/anmelden" className="text-[#3D5AFE]">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
