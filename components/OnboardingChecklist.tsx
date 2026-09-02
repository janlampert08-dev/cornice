"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Compass, Route as RouteIcon, UserPlus, X } from "lucide-react";
import Card from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";

const STORAGE_KEY = "cornice-onboarding-dismissed";
const DISMISS_EVENT = "cornice-onboarding-dismiss";

// Gleiches useSyncExternalStore-Muster wie ThemeToggle.tsx: liest
// localStorage SSR-sicher (Server-Snapshot "nicht weggeklickt" fürs erste
// Rendern, danach vom Client auf den echten Wert korrigiert), statt
// setState synchron in einem Effekt aufzurufen. Ein eigenes Event statt nur
// des nativen "storage"-Events, da Letzteres im auslösenden Tab selbst
// nicht feuert.
function readDismissed(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function readServerDismissed(): boolean {
  return false;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISS_EVENT, callback);
  };
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
// /willkommen-Seite: dieselben Schritte liegen jetzt als schliessbare
// Checkliste direkt auf der Startseite (app/page.tsx), sichtbar auch für
// anonyme Erstbesucher — "Konto erstellen" wird selbst zum ersten Schritt,
// statt Voraussetzung fürs Onboarding zu sein. Jeder Haken kommt aus
// echtem Serverzustand (loggedIn/hasVehicle/hasTrackedRide), nicht aus dem
// lokalen Speicher — ein Sprung auf eine andere Seite (z. B. Registrierung)
// und zurück lässt bereits erledigte Schritte darum zuverlässig
// durchgestrichen stehen, statt die Checkliste abzubrechen oder
// zurückzusetzen. Nur das explizite Wegklicken (X) wird lokal gemerkt.
export default function OnboardingChecklist({
  loggedIn,
  hasVehicle,
  hasTrackedRide,
}: {
  loggedIn: boolean;
  hasVehicle: boolean;
  hasTrackedRide: boolean;
}) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, readServerDismissed);

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

  // Nach Wegklicken oder vollständigem Abschluss: nichts rendern. (Server-
  // Snapshot ist immer "nicht weggeklickt" — ein bereits weggeklickter
  // Rückkehrer sieht die Karte darum kurz aufblitzen, bevor der Client auf
  // den echten Wert korrigiert; gleicher, bereits akzeptierter Trade-off
  // wie beim Farbschema in ThemeToggle.tsx.)
  if (dismissed || steps.every((s) => s.done)) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <Card surface className="relative mx-4 mt-4 flex flex-col gap-3 p-4 sm:mx-6">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Checkliste schliessen"
        className="absolute top-3 right-3 text-muted transition-colors duration-fast hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="pr-6">
        <p className="text-sm font-semibold">Willkommen bei Cornice!</p>
        <p className="text-sm text-muted">Drei kurze Schritte, um loszulegen:</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.key}
              className="flex flex-1 items-start gap-2.5 rounded-lg border border-border p-3"
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
    </Card>
  );
}
