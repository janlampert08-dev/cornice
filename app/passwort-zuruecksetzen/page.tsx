import Link from "next/link";
import Header from "@/components/Header";
import PasswortZuruecksetzenForm from "@/components/PasswortZuruecksetzenForm";
import { createClient } from "@/lib/supabase/server";

export default async function PasswortZuruecksetzenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/anmelden" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
        {user ? (
          <PasswortZuruecksetzenForm />
        ) : (
          // Ohne Session ist entweder der Link bereits abgelaufen/eingelöst
          // oder die Seite wurde ohne gültigen Reset-Link direkt aufgerufen —
          // in beiden Fällen gibt es hier nichts zu tun.
          <>
            <h1 className="text-display font-semibold">Link ungültig</h1>
            <p className="text-sm text-muted">
              Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.
            </p>
            <Link
              href="/passwort-vergessen"
              className="font-medium text-accent hover:underline"
            >
              Neuen Link anfordern
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
