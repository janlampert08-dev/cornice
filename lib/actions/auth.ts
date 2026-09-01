"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/utils/url";

export interface AuthFormState {
  error: string | null;
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der E-Mail).",
      };
    }
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  redirect("/profil");
}

// PostgREST reicht ilike als SQL LIKE durch — % und _ (und \ selbst) haben
// dort Sonderbedeutung als Wildcards und müssen escaped werden, sonst würde
// z.B. der Name "50%" jeden zweistelligen Namen fälschlich als vergeben melden.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();

  if (password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen lang sein." };
  }
  if (displayName.length < 2) {
    return { error: "Benutzername muss mindestens 2 Zeichen lang sein." };
  }
  if (displayName.length > 50) {
    return { error: "Benutzername darf höchstens 50 Zeichen lang sein." };
  }

  const supabase = await createClient();

  // Case-insensitiver Vorab-Check statt eines DB-Unique-Constraints: die
  // Profile-Tabelle existiert schon mit ggf. vorhandenen Alt-Daten, ein
  // nachträglicher unique-Index könnte auf bestehenden Kollisionen scheitern.
  // Kein hartes Sicherheitsmerkmal (anders als z.B. der Cooldown-Trigger in
  // 0024) — ein sehr seltenes Race zwischen zwei gleichzeitigen
  // Registrierungen mit demselben Namen ist hier tolerierbar.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .ilike("display_name", escapeLikePattern(displayName))
    .maybeSingle();

  if (existing) {
    return { error: "Dieser Benutzername ist bereits vergeben." };
  }

  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Bei aktivierter E-Mail-Bestätigung liefert signUp() für eine bereits
  // registrierte, bestätigte Adresse keinen Fehler (Supabase schützt so
  // selbst gegen Enumeration) — erkennbar nur daran, dass identities leer
  // bleibt statt eine neue Identity zu enthalten. Offiziell von Supabase
  // dokumentierter Weg, das client-seitig zu unterscheiden, um dem Nutzer
  // trotzdem eine Rückmeldung zu geben statt ihn auf eine nie versendete
  // Bestätigungsmail warten zu lassen.
  if (data.user?.identities?.length === 0) {
    return { error: "Diese E-Mail-Adresse ist bereits registriert." };
  }

  // Ist "Confirm email" im Supabase-Projekt deaktiviert, liefert signUp
  // bereits eine aktive Session — dann direkt einloggen statt auf eine
  // (nie versendete) Bestätigungsmail zu verweisen. Führt wie der
  // E-Mail-Bestätigungslink (app/auth/callback/route.ts) zu /willkommen,
  // da dies ebenfalls eine Neuregistrierung ist.
  if (data.session) {
    redirect("/willkommen");
  }

  redirect("/registrieren/bestaetigen");
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const origin = await getOrigin();

  // Bewusst kein Fehler, wenn die E-Mail nicht existiert — anders als bei
  // signUp() oben (wo der Trade-off zugunsten besserer UX bewusst gewünscht
  // ist), da hier über einen bekannten Konto-Fehler hinaus zusätzlich
  // verraten würde, welche E-Mail-Adressen überhaupt registriert sind.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/passwort-zuruecksetzen`,
  });

  redirect("/passwort-vergessen/gesendet");
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Nur mit einer aktiven Recovery-Session aus dem E-Mail-Link erreichbar
  // (app/auth/callback/route.ts tauscht den Code gegen eine Session, bevor
  // /passwort-zuruecksetzen überhaupt lädt) — ohne Session gibt es nichts
  // zu aktualisieren.
  if (!user) {
    return {
      error: "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Passwort konnte nicht geändert werden. Bitte versuche es erneut." };
  }

  redirect("/profil");
}
