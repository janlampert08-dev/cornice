"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { error: null };

export default function AnmeldenPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <h1 className="text-xl font-semibold">Anmelden</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          E-Mail
          <input
            type="email"
            name="email"
            required
            className="rounded-xl border border-[#131316]/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE] focus:ring-2 focus:ring-[#3D5AFE]/15 transition-shadow"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            name="password"
            required
            className="rounded-xl border border-[#131316]/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#3D5AFE] focus:ring-2 focus:ring-[#3D5AFE]/15 transition-shadow"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-[#131316] bg-[#131316] shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
      <p className="text-sm text-[#8A8F98]">
        Noch kein Konto?{" "}
        <Link href="/registrieren" className="text-[#3D5AFE]">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
