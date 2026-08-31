import { headers } from "next/headers";

// Ermittelt die aktuelle Origin aus den Request-Headern, damit
// E-Mail-Bestätigungslinks in jeder Umgebung (localhost, Vercel-Preview,
// Produktion) auf die richtige Domain zeigen, ohne sie fest zu verdrahten.
export async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

// Validiert einen aus einem ?next=-Query-Parameter oder Formularfeld
// stammenden Rücksprungpfad (z. B. app/profil/fahrzeuge/neu/page.tsx aus dem
// Onboarding), bevor er als redirect()-Ziel verwendet wird — muss ein
// interner, mit "/" beginnender Pfad sein und darf nicht mit "//" oder
// "/\" beginnen (beides vom Browser als protokollrelative externe URL
// interpretiert, z. B. "//evil.example"). Andernfalls null, der Aufrufer
// fällt dann auf einen festen Default-Pfad zurück. Verhindert einen
// Open-Redirect über einen manipulierten next-Wert.
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}
