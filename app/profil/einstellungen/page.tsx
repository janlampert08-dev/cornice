import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound, Lock, MapPin, Palette } from "lucide-react";
import Header from "@/components/Header";
import VisibilitySettings from "@/components/VisibilitySettings";
import ThemeToggle from "@/components/ThemeToggle";
import DeleteProposalButton from "@/components/DeleteProposalButton";
import SettingsTabs from "@/components/SettingsTabs";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

// Ein Einstellungen-Tab statt vorher verstreuter Zugänge: Privatsphäre
// (bisher app/profil/privatsphaere, hierher verschoben), Darstellung
// (Hell/Dunkel — bisher nur im Header erreichbar, hier zusätzlich für
// Auffindbarkeit), Streckenvorschläge (bisher Teil der "Verwaltung"-Gruppe
// auf der Profilseite) und Konto (Passwort ändern — bisher ohne jeden
// Einstieg aus der UI, nur über den Passwort-Reset-Link erreichbar).
export default async function EinstellungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const [{ data: profile }, { data: ownRoutes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("zeigt_fahrzeuge, zeigt_avatar, zeigt_paesse, zeigt_hoehenmeter, zeigt_distanz")
      .eq("id", user.id)
      .single(),
    supabase
      .from("routes")
      .select("id, name, status_ok, abgelehnt_am, ist_privat")
      .eq("erstellt_von", user.id)
      .order("created_at", { ascending: false })
      .returns<
        {
          id: string;
          name: string;
          status_ok: boolean;
          abgelehnt_am: string | null;
          ist_privat: boolean;
        }[]
      >(),
  ]);

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/profil" />
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-10">
          <h1 className="text-display font-semibold">Einstellungen</h1>

          <SettingsTabs
            tabs={[
              {
                id: "privatsphaere",
                label: "Privatsphäre",
                icon: Lock,
                content: (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted">
                      Legt fest, was andere Nutzer auf deinem öffentlichen Profil sehen.
                      Standardmässig ist alles aus. Ob eine einzelne Fahrt öffentlich ist,
                      entscheidest du separat im Fazit-Screen beim Speichern oder per Symbol bei
                      &bdquo;Getrackte Fahrten&ldquo; in deinem Profil.
                    </p>
                    <VisibilitySettings
                      zeigtFahrzeuge={profile?.zeigt_fahrzeuge ?? false}
                      zeigtAvatar={profile?.zeigt_avatar ?? false}
                      zeigtPaesse={profile?.zeigt_paesse ?? false}
                      zeigtHoehenmeter={profile?.zeigt_hoehenmeter ?? false}
                      zeigtDistanz={profile?.zeigt_distanz ?? false}
                    />
                  </div>
                ),
              },
              {
                id: "darstellung",
                label: "Darstellung",
                icon: Palette,
                content: (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted">Farbschema für die ganze App.</p>
                    <ThemeToggle />
                  </div>
                ),
              },
              {
                id: "strecken",
                label: "Streckenvorschläge",
                icon: MapPin,
                content:
                  ownRoutes && ownRoutes.length > 0 ? (
                    <Card as="ul" className="divide-y divide-border">
                      {ownRoutes.map((route) => {
                        const label = route.status_ok
                          ? "Bewilligt"
                          : route.ist_privat
                            ? "Privat"
                            : route.abgelehnt_am
                              ? "Abgelehnt"
                              : "Ausstehend";
                        const color = route.status_ok
                          ? "text-accent"
                          : route.abgelehnt_am
                            ? "text-danger"
                            : "text-muted";
                        return (
                          <li key={route.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <Link
                              href={`/strecken/${route.id}`}
                              className="truncate transition-colors duration-fast hover:text-accent"
                            >
                              {route.name}
                            </Link>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className={`text-sm font-medium ${color}`}>{label}</span>
                              {!route.status_ok && (
                                <Link
                                  href={`/strecken/${route.id}/bearbeiten`}
                                  className="text-xs text-muted hover:text-foreground"
                                >
                                  Bearbeiten
                                </Link>
                              )}
                              {route.abgelehnt_am && <DeleteProposalButton routeId={route.id} />}
                            </div>
                          </li>
                        );
                      })}
                    </Card>
                  ) : (
                    <p className="text-sm text-muted">Noch keine Streckenvorschläge eingereicht.</p>
                  ),
              },
              {
                id: "konto",
                label: "Konto",
                icon: KeyRound,
                content: (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted">{user.email}</p>
                    <Link
                      href="/profil/passwort-aendern"
                      className={buttonVariants({ variant: "secondary", size: "sm", className: "self-start" })}
                    >
                      Passwort ändern
                    </Link>
                  </div>
                ),
              },
            ]}
          />
        </main>
      </div>
    </div>
  );
}
