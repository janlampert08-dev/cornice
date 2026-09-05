import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import MarkKudosSeen from "@/components/MarkKudosSeen";
import { getRecentKudosReceived } from "@/lib/kudos";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = {
  title: "Aktivität – Cornice",
};

// Eigene Seite für "Community reagiert" im Kernloop (siehe AGENTS.md, "Core
// User Loop", Schritt 7→8) statt nur eines Badges auf dem Profil-Tab — der
// Desktop-Header verlinkt hierher (Header.tsx), analog zum bisherigen
// Ungelesen-Zähler (lib/kudos.ts, getUnseenKudosCount). Nur der Besitzer
// selbst sieht seine eigene Liste, siehe recent_kudos_received
// (0057_kudos_aktivitaetsliste.sql) — ausschliesslich auf auth.uid()
// beschränkt.
export default async function AktivitaetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const kudosList = await getRecentKudosReceived();

  return (
    <div className="flex h-dvh flex-col">
      <Header back="/profil" />
      {/* Markiert beim Laden alle aktuell ungelesenen Kudos als gesehen,
          siehe MarkKudosSeen.tsx — dieselbe Komponente wie bisher auf
          /profil, hier zusätzlich statt stattdessen. */}
      <MarkKudosSeen />
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-10">
          <div>
            <h1 className="text-display font-semibold">Aktivität</h1>
            <p className="mt-1 text-sm text-muted">Kudos auf deine geteilten Fahrten.</p>
          </div>

          {kudosList.length === 0 ? (
            <EmptyState icon={Heart} title="Noch keine Kudos erhalten." />
          ) : (
            <ul className="flex flex-col gap-3">
              {kudosList.map((kudos) => (
                <Card
                  as="li"
                  key={`${kudos.completionId}-${kudos.giverId}`}
                  className="flex items-center gap-3 p-4"
                >
                  <Avatar url={kudos.giverAvatarUrl} name={kudos.giverDisplayName} size={40} />
                  <Link
                    href={`/fahrten/${kudos.completionId}`}
                    className="min-w-0 flex-1 transition-colors duration-fast hover:text-accent"
                  >
                    <p className="truncate text-sm">
                      <span className="font-medium">{kudos.giverDisplayName ?? "Ein Fahrer"}</span>{" "}
                      hat deiner Fahrt Kudos gegeben
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(kudos.erstelltAm).toLocaleString("de-CH", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                  {kudos.neu && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Neu" />}
                </Card>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
