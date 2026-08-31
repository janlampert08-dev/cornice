import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Compass, Route as RouteIcon } from "lucide-react";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/Button";
import Card from "@/components/ui/Card";

// Landet nur, wer gerade die Registrierung abgeschlossen hat (siehe
// app/auth/callback/route.ts und lib/actions/auth.ts signUp()) — nicht Teil
// der regulären Anmeldung (signIn() geht weiterhin direkt zu /profil).
// Rein hinweisend: beide vorgeschlagenen Schritte sind jederzeit auch später
// über die normale Navigation erreichbar, nichts wird hier erzwungen.
export default async function WillkommenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  // Beide unabhängig voneinander, parallel statt nacheinander abgefragt.
  // count: "exact", head: true holt nur die Zeilenzahl, keine Fahrzeugdaten
  // — hier reicht "gibt es mindestens eins".
  const [{ data: profile }, { count: vehicleCount }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const hasVehicle = (vehicleCount ?? 0) > 0;

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-10">
        <div>
          <h1 className="text-display font-semibold">
            Willkommen{profile?.display_name ? `, ${profile.display_name}` : ""}!
          </h1>
          <p className="mt-2 text-sm text-muted">
            Cornice hilft dir, kuratierte Fahrstrecken für Auto und Motorrad zu entdecken,
            gefahrene Strecken zu tracken und dich mit anderen zu messen. Zwei kurze Schritte,
            um loszulegen:
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Card surface className="flex items-start gap-3 p-4">
            {hasVehicle ? (
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-background">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            ) : (
              <RouteIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            )}
            <div className="flex flex-1 flex-col gap-2">
              <p className={`text-sm font-medium ${hasVehicle ? "text-muted line-through" : ""}`}>
                Fahrzeug hinzufügen
              </p>
              {!hasVehicle && (
                <>
                  <p className="text-sm text-muted">
                    Damit du Fahrten einem Auto oder Motorrad zuordnen kannst.
                  </p>
                  <Link
                    href="/profil/fahrzeuge/neu?next=/willkommen"
                    className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}
                  >
                    Fahrzeug hinzufügen
                  </Link>
                </>
              )}
            </div>
          </Card>
          <Card surface className="flex items-start gap-3 p-4">
            <Compass className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm font-medium">Strecken entdecken</p>
              <p className="text-sm text-muted">
                Kuratierte Pass- und Panoramastrassen in deiner Nähe finden.
              </p>
              <Link
                href="/"
                className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}
              >
                Strecken entdecken
              </Link>
            </div>
          </Card>
        </div>

        <Link href="/profil" className="self-center text-sm text-muted hover:text-foreground">
          Später einrichten →
        </Link>
      </main>
    </div>
  );
}
