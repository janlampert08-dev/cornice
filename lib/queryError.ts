import type { PostgrestError } from "@supabase/supabase-js";

// Ein Query-Fehler ist etwas anderes als "keine Zeilen" — und Supabase
// liefert beides ununterscheidbar aus, wenn man nur auf data schaut:
// maybeSingle() gibt bei fehlender Zeile data = null *ohne* error zurück,
// eine Listenabfrage ein leeres Array. Wer beides gleich behandelt, rendert
// einen Ausfall als Tatsachenbehauptung — "diese Fahrt existiert nicht"
// (404 statt Fehlerseite), "0 km gefahren", "keine Fotos".
//
// Deshalb: einmal zentral werfen, damit das error.tsx-Boundary greift und der
// Fehler im Log landet. Nicht gefundene Zeilen bleiben davon unberührt und
// werden weiterhin von den Aufrufern behandelt (null bzw. leere Liste).
//
// Gegenstück zu getRoute() in lib/routes.ts, das dieselbe Unterscheidung von
// Hand macht (dort mit .single(), also inklusive PGRST116-Sonderfall).
export function throwOnQueryError(
  error: PostgrestError | null,
  bezeichnung: string,
): void {
  if (!error) return;
  console.error(`${bezeichnung} konnte nicht geladen werden:`, error.message);
  throw new Error(`${bezeichnung} konnte nicht geladen werden.`);
}
