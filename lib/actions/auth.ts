"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // E-Mail-Bestätigungslink (app/auth/callback/route.ts) zur Startseite,
  // wo die Onboarding-Checkliste (components/OnboardingChecklist.tsx) den
  // "Konto erstellen"-Schritt jetzt durchgestrichen zeigt.
  if (data.session) {
    redirect("/");
  }

  redirect("/registrieren/bestaetigen");
}

export interface RequestPasswordResetState {
  error: string | null;
  requested: boolean;
}

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Bitte E-Mail-Adresse eingeben.", requested: false };

  const supabase = await createClient();
  const origin = await getOrigin();
  // next ist hier ein fest verdrahteter interner Pfad, kein Nutzereingabewert
  // — dieselbe origin+next-Konkatenation wie beim bestehenden E-Mail-
  // Bestätigungslink in signUp() (siehe app/auth/callback/route.ts).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/profil/passwort-aendern`,
  });

  // resetPasswordForEmail liefert bei unbekannter Adresse ebenfalls keinen
  // Fehler (Supabase verhindert damit selbst schon Konto-Enumeration) — die
  // konstante Erfolgsmeldung hier ist daher die korrekte Antwort in beiden
  // Fällen, kein Verstecken eines echten Fehlers.
  return { error: null, requested: true };
}

export interface UpdatePasswordState {
  error: string | null;
}

export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Der Link ist abgelaufen. Bitte fordere einen neuen an." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Passwort konnte nicht geändert werden." };

  redirect("/profil");
}

export interface DeleteAccountState {
  error: string | null;
}

// Löscht kein auth.users-Zeile (siehe 0042_account_deletion.sql für die
// ausführliche Begründung — würde per Cascade Fahrten/Bewertungen/Kudos/
// Follows mitreissen), sondern anonymisiert das Profil und entwertet die
// Zugangsdaten, sodass sich niemand mehr mit dem alten Passwort anmelden
// kann. Verlangt eine erneute Passwort-Eingabe direkt vor der irreversiblen
// Aktion — anders als bei den übrigen destruktiven Aktionen dieser App
// (ConfirmDialog reicht dort), da eine unbeaufsichtigt offene Sitzung
// (geteiltes Gerät, vergessene Abmeldung) sonst mit einem einzigen Klick
// das ganze Konto unwiderruflich deaktivieren könnte.
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return { error: "Bitte melde dich zuerst an." };

  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Bitte gib dein Passwort zur Bestätigung ein." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (reauthError) return { error: "Passwort ist falsch." };

  // Anonymisiert das eigene Profil und löscht eigene Fahrzeuge — läuft über
  // die normale, session-gebundene Verbindung (kein user.id-Parameter
  // nötig/möglich, anonymize_own_account() bindet sich selbst über
  // auth.uid()), siehe 0042 für die Details.
  const { error: anonymizeError } = await supabase.rpc("anonymize_own_account");
  if (anonymizeError) return { error: "Konto konnte nicht gelöscht werden." };

  // Zugangsdaten entwerten: nur über den Admin-Client möglich (Supabase Auth
  // ist kein per-RLS steuerbares Postgres-Schema). Gerechtfertigt trotz
  // Service-Role-RLS-Bypass, weil user.id direkt aus der oben verifizierten,
  // gerade erst per Passwort re-authentifizierten Session stammt — nicht aus
  // einem client-gesteuerten Parameter (siehe AGENTS.md, admin.ts). Die
  // synthetische E-Mail gibt die ursprüngliche Adresse für eine künftige
  // Neu-Registrierung frei und entfernt sie als personenbezogenes Datum aus
  // auth.users; das zufällige Passwort macht die alten Zugangsdaten nutzlos.
  const admin = createAdminClient();
  const { error: revokeError } = await admin.auth.admin.updateUserById(user.id, {
    email: `geloescht-${user.id}@geloescht.cornice.invalid`,
    password: crypto.randomUUID() + crypto.randomUUID(),
    email_confirm: true,
  });
  if (revokeError) {
    // Profil ist bereits anonymisiert (oben) — dieser Schritt lässt sich
    // gefahrlos erneut versuchen (anonymize_own_account ist idempotent),
    // daher hier abbrechen statt mit ungültigen Zugangsdaten weiterzumachen.
    return { error: "Konto konnte nicht vollständig gelöscht werden. Bitte versuche es erneut." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
