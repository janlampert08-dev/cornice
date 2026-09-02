"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Compass, Route as RouteIcon, UserPlus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { buttonVariants } from "@/components/ui/Button";

const STORAGE_KEY = "cornice-onboarding-dismissed";
const DISMISS_EVENT = "cornice-onboarding-dismiss";

// Fällt zurück auf diesen In-Memory-Wert, wenn localStorage blockiert ist
// (strikte Privatsphäre-Einstellungen, manche iFrame-Kontexte etc. werfen
// dort einen SecurityError statt einfach nichts zu speichern) — ohne
// diesen Fallback liesse sich die Checkliste in so einem Fall nicht einmal
// für die laufende Sitzung schliessen. Überlebt keinen Reload, aber mehr
// ist ohne persistenten Speicher ohnehin nicht möglich.
let memoryDismissed = false;

// Gleiches useSyncExternalStore-Muster wie ThemeToggle.tsx: liest
// localStorage SSR-sicher (Server-Snapshot "nicht weggeklickt" fürs erste
// Rendern, danach vom Client auf den echten Wert korrigiert), statt
// setState synchron in einem Effekt aufzurufen. Ein eigenes Event statt nur
// des nativen "storage"-Events, da Letzteres im auslösenden Tab selbst
// nicht feuert.
function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return memoryDismissed;
  }
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
// /willkommen-Seite: dieselben Schritte erscheinen jetzt als schliessbares
// Dialog-Overlay direkt auf der Startseite (app/page.tsx), sichtbar auch
// für anonyme Erstbesucher — "Konto erstellen" wird selbst zum ersten
// Schritt, statt Voraussetzung fürs Onboarding zu sein. Mittig als Overlay
// (natives <dialog>, gleiches Dialog.tsx-Primitiv wie FollowListModal),
// statt als Karte oben in den normalen Seitenfluss eingebettet — ein neuer
// Nutzer landet sonst direkt in der vollen Explore-Ansicht (Karte + Liste +
// Filter) UND einer zusätzlichen Karte gleichzeitig, was auf den ersten
// Blick überladen wirkt. Jeder Haken kommt aus echtem Serverzustand
// (loggedIn/hasVehicle/hasTrackedRide), nicht aus dem lokalen Speicher —
// ein Sprung auf eine andere Seite (z. B. Registrierung) und zurück lässt
// bereits erledigte Schritte darum zuverlässig durchgestrichen stehen,
// statt die Checkliste abzubrechen oder zurückzusetzen. Nur das explizite
// Schliessen (Backdrop-Klick, Escape oder "Später einrichten") wird lokal
// gemerkt.
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

  // Server-Snapshot ist immer "nicht weggeklickt" — ein bereits
  // weggeklickter Rückkehrer sieht das Overlay darum kurz aufblitzen, bevor
  // der Client auf den echten Wert korrigiert; gleicher, bereits
  // akzeptierter Trade-off wie beim Farbschema in ThemeToggle.tsx.
  const allDone = steps.every((s) => s.done);

  // Dialog.tsx ruft el.close() (und damit onClose -> handleDismiss) auch,
  // wenn open programmatisch auf false wechselt — hier also sobald allDone
  // true wird, nicht nur bei echtem Nutzer-Dismiss (Backdrop/Escape/
  // "Später einrichten"). Ohne diese Guard würde der letzte erledigte
  // Schritt fälschlich auch "weggeklickt" persistieren: würde später ein
  // Schritt wieder offen (z. B. das einzige Fahrzeug gelöscht), bliebe die
  // Checkliste wegen des dann unnötig gesetzten dismissed-Flags trotzdem
  // versteckt, obwohl niemand sie je geschlossen hat.
  function handleDismiss() {
    if (allDone) return;
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      memoryDismissed = true;
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <Dialog
      open={!dismissed && !allDone}
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
