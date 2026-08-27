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
