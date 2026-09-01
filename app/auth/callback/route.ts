import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ziel sowohl des Bestätigungslinks einer Neuregistrierung als auch des
// Passwort-zurücksetzen-Links (aus der jeweils unveränderten Supabase-
// Standard-E-Mail) → Supabase verifiziert serverseitig und leitet hierher
// mit ?code=... weiter (PKCE-Flow). Welcher der beiden Fälle vorliegt,
// steuert einzig der jeweils mitgeschickte next-Pfad (siehe emailRedirectTo
// in lib/actions/auth.ts signUp() bzw. requestPasswordReset()) — die
// reguläre Anmeldung (signIn()) läuft nie über diese Route. "/willkommen"
// ist daher als Default sicher, ohne bestehende Nutzer zu beeinflussen.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/willkommen";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/anmelden?fehler=bestaetigung`);
}
