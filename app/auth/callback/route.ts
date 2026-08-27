import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ziel des Bestätigungslinks aus der (unveränderten) Supabase-Standard-E-Mail:
// {{ .ConfirmationURL }} → Supabase verifiziert serverseitig und leitet hierher
// mit ?code=... weiter (PKCE-Flow).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profil";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/anmelden?fehler=bestaetigung`);
}
