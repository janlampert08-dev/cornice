import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/url";

// Ziel der (unveränderten) Supabase-Standard-E-Mails: {{ .ConfirmationURL }}
// → Supabase verifiziert serverseitig und leitet hierher mit ?code=...
// weiter (PKCE-Flow). Wird von zwei Flows genutzt: der Neuregistrierung
// (kein "next", siehe emailRedirectTo in lib/actions/auth.ts signUp() →
// Default "/willkommen") und dem Passwort-Reset (next=/passwort-zuruecksetzen,
// siehe requestPasswordReset()). Die reguläre Anmeldung (signIn()) läuft nie
// über diese Route.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next")) ?? "/willkommen";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/anmelden?fehler=bestaetigung`);
}
