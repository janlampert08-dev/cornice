// Zentrale Konstante für den Custom-Event-Namen, den ThemeToggle.tsx bei
// jedem manuellen Wechsel feuert (localStorage-Schreibvorgänge lösen im
// selben Tab kein "storage"-Event aus) — von hier importierbar für alle
// Stellen, die live auf einen Themenwechsel reagieren müssen (z.B. der
// Kartenstil in RouteMap.tsx/RoutePicker.tsx).
export const THEME_CHANGE_EVENT = "cornice-theme-change";

// Liest das aktuell wirksame Farbschema: eine explizite Wahl (data-theme,
// siehe ThemeToggle.tsx) gewinnt, sonst die System-Einstellung.
export function isDarkTheme(): boolean {
  const explicit = document.documentElement.dataset.theme;
  return explicit === "dark" || (!explicit && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

// Ruft callback bei jedem Themenwechsel auf: manueller Toggle
// (THEME_CHANGE_EVENT), ein Wechsel in einem anderen Browser-Tab (storage)
// und — sofern "System" aktiv ist — eine geänderte Betriebssystem-
// Einstellung (matchMedia).
export function subscribeToThemeChange(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    media.removeEventListener("change", callback);
  };
}
