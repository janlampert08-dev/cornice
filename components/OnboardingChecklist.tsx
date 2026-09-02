"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Compass, Route as RouteIcon, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { buttonVariants } from "@/components/ui/Button";

const STORAGE_KEY = "cornice-onboarding-dismissed";

// Fällt zurück auf diesen In-Memory-Wert, wenn localStorage blockiert ist
// (strikte Privatsphäre-Einstellungen, manche iFrame-Kontexte etc. werfen
// dort einen SecurityError statt einfach nichts zu speichern) — ohne
// diesen Fallback liesse sich die Checkliste in so einem Fall nicht einmal
// für die laufende Sitzung als gesehen markieren. Überlebt keinen Reload,
// aber mehr ist ohne persistenten Speicher ohnehin nicht möglich.
let memoryDismissed = false;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return memoryDismissed;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    memoryDismissed = true;
  }
}

interface Step {
  key: string;
  done: boolean;
  icon: typeof UserPlus;
  title: string;
  description: string;
  href: string | null;
  cta: string | null;
}

// Ersetzt die vorherige, nur nach abgeschlossener Registrierung erreichbare
// /willkommen-Seite: dieselben Schritte erscheinen jetzt als schliessbares
// Dialog-Overlay direkt auf der Startseite (app/page.tsx), sichtbar auch
// für anonyme Erstbesucher — "Konto erstellen" wird selbst zum ersten
// Schritt, statt Voraussetzung fürs Onboarding zu sein. Mittig als Overlay
// (natives <dialog>, gleiches Dialog.tsx-Primitiv wie FollowListModal),
// statt als Karte oben in den normalen Seitenfluss eingebettet — ein neuer
// Nutzer landet sonst direkt in der vollen Explore-Ansicht (Karte + Liste +
// Filter) UND einer zusätzlichen Karte gleichzeitig, was auf den ersten
// Blick überladen wirkt.
//
// Erscheint nur einmal pro Browser: sobald der Dialog beim Laden der
// Startseite gezeigt werden würde, gilt er ab da als gesehen (localStorage)
// — unabhängig davon, ob und wie er geschlossen wird (Backdrop, Escape,
// "Später einrichten", ein CTA-Klick der wegnavigiert, oder der Tab wird
// einfach geschlossen) und unabhängig vom späteren Fortschritt der Schritte.
// Eine frühere Version merkte sich nur ein explizites Wegklicken und liess
// die Checkliste sonst bei jedem Besuch erneut aufblitzen, bis alle drei
// Schritte erledigt waren — was wie ein Bug wirkte, wenn jemand die Seite
// bloss besucht (z. B. nur eine Strecke angeschaut), ohne aktiv auf
// Hintergrund/Escape/"Später einrichten" zu klicken.
export default function OnboardingChecklist({
  loggedIn,
  hasVehicle,
  hasTrackedRide,
}: {
  loggedIn: boolean;
  hasVehicle: boolean;
  hasTrackedRide: boolean;
}) {
  const steps: Step[] = [
    {
      key: "konto",
      done: loggedIn,
      icon: UserPlus,
      title: "Konto erstellen",
      description: "Damit du Fahrten tracken und Strecken vorschlagen kannst.",
      href: "/registrieren",
      cta: "Konto erstellen",
    },
    {
      key: "fahrzeug",
      done: hasVehicle,
      icon: RouteIcon,
      title: "Fahrzeug hinzufügen",
      description: "Damit du Fahrten einem Auto oder Motorrad zuordnen kannst.",
      href: "/profil/fahrzeuge/neu?next=/",
      cta: "Fahrzeug hinzufügen",
    },
    {
      key: "fahrt",
      done: hasTrackedRide,
      icon: Compass,
      title: "Erste Fahrt tracken",
      description: "Wähle unten eine Strecke aus und starte das Live-Tracking.",
      href: null,
      cta: null,
    },
  ];

  const allDone = steps.every((s) => s.done);

  // Lazy Initializer statt Effekt-getriebenem setState (vermeidet
  // react-hooks/set-state-in-effect): reines Lesen, läuft nur einmal beim
  // ersten Rendern dieser Komponenteninstanz. Auf dem Server ist window
  // nicht verfügbar — dort also immer false, was unproblematisch ist, da
  // Dialog.tsx den open-Prop ohnehin nur für showModal()/close() in einem
  // eigenen Effekt nutzt, nie für serverseitig gerendertes Markup (kein
  // open-Attribut im JSX unten) — es gibt also nichts, das bei der
  // Hydration nicht übereinstimmen könnte.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !readDismissed() && !allDone;
  });

  // Reine Schreibaktion auf ein externes System (kein setState) — erlaubt
  // laut react-hooks/set-state-in-effect ausdrücklich in einem Effekt.
  // Markiert den Dialog ab dem ersten Rendern als gesehen, unabhängig
  // davon, ob er hier überhaupt geöffnet wird (z. B. weil allDone schon
  // beim Laden zutrifft) oder wie er später geschlossen wird — "einmal pro
  // Browser, dann nie wieder" statt nur bei explizitem Wegklicken.
  useEffect(() => {
    if (!readDismissed()) persistDismissed();
  }, []);

  function handleDismiss() {
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      title="Willkommen bei Cornice!"
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted">Drei kurze Schritte, um loszulegen:</p>
      <div className="flex flex-col gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className="flex items-start gap-2.5 rounded-lg border border-border p-3"
            >
              {step.done ? (
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-background">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : (
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              )}
              <div className="flex flex-1 flex-col gap-1.5">
                <p className={`text-sm font-medium ${step.done ? "text-muted line-through" : ""}`}>
                  {step.title}
                </p>
                {!step.done && (
                  <>
                    <p className="text-xs text-muted">{step.description}</p>
                    {step.href && (
                      <Link
                        href={step.href}
                        className={buttonVariants({
                          variant: "secondary",
                          size: "sm",
                          className: "self-start",
                        })}
                      >
                        {step.cta}
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="self-center text-sm text-muted hover:text-foreground"
      >
        Später einrichten →
      </button>
    </Dialog>
  );
}
