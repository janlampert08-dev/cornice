"use client";

import { useSyncExternalStore, type ComponentType } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_CHANGE_EVENT } from "@/lib/theme";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "cornice-theme";

const OPTIONS: { value: ThemePreference; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
];

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function readServerPreference(): ThemePreference {
  return "system";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function applyTheme(pref: ThemePreference) {
  if (pref === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = pref;
  }
}

// Manuelle Übersteuerung der prefers-color-scheme-Systemeinstellung (siehe
// app/globals.css: :root[data-theme] gewinnt in beide Richtungen gegen die
// @media-Abfrage). Das blockierende Inline-Script in app/layout.tsx setzt
// das data-theme-Attribut bereits vor dem ersten Paint aus localStorage —
// dieser Komponente bleibt nur, es interaktiv umzuschalten.
//
// useSyncExternalStore statt useState+useEffect: liest eine echte externe
// Quelle (localStorage) SSR-sicher — der Server-Snapshot ("system") wird
// für den ersten Client-Render übernommen, React korrigiert danach in
// einem eigenen, dafür vorgesehenen Mechanismus auf den echten Wert, ohne
// dass hier manuell setState im Effekt aufgerufen werden muss.
export default function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, readPreference, readServerPreference);

  function choose(pref: ThemePreference) {
    if (pref === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
    applyTheme(pref);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className="flex shrink-0 items-center gap-0.5 rounded-full border border-border p-0.5"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          title={label}
          onClick={() => choose(value)}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            preference === value ? "bg-accent text-background" : "text-muted hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
