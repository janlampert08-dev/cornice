"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 700;

// Kein Hochzählen für Nutzer, die reduzierte Bewegung bevorzugen — zeigt den
// Endwert direkt an, kein Layout-Unterschied.
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// unit als reiner String statt eine format-Funktion als Prop: alle
// Aufrufstellen sind Server Components (app/profil/page.tsx) — eine Funktion
// liesse sich nicht über die Server/Client-Grenze serialisieren (React
// wirft zur Laufzeit "Functions cannot be passed directly to Client
// Components", vom Build nicht erkannt, nur beim tatsächlichen Rendern).
export default function CountUp({ value, unit }: { value: number; unit?: string }) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    // Lazy-Initializer oben hat den Endwert bereits gesetzt — hier nur noch
    // die Animation überspringen, kein weiterer setState-Aufruf nötig
    // (Werte ändern sich in der aktuellen Verwendung nicht während der
    // Mount-Dauer, da die Server-Component-Seite bei neuen Daten neu lädt).
    if (prefersReducedMotion()) return;

    let raf: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // ease-out-cubic — schnell los, sanft einrasten statt linear zu stoppen.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const formatted = Math.round(display).toLocaleString("de-CH");
  return <>{unit ? `${formatted} ${unit}` : formatted}</>;
}
