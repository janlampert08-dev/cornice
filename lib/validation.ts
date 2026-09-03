const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Alle IDs in dieser App (Strecken, Fahrten, Bewertungen, Nutzer, Fahrzeuge)
// sind Postgres-uuid-Spalten. Ein früher Format-Check vermeidet unnötige
// DB-Roundtrips für offensichtlich manipulierte oder fehlerhafte IDs, bevor
// sie überhaupt in eine Query eingesetzt werden.
export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}
