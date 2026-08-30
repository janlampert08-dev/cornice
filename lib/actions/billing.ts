"use server";

// Premium-UI ist vorerst deaktiviert (siehe components/PremiumCard.tsx) —
// diese Actions sind dadurch von keiner Seite mehr aus erreichbar, bleiben
// aber unverändert bestehen, damit Premium später ohne Backend-Änderungen
// reaktiviert werden kann.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Legt bei Bedarf einen Stripe-Customer an (einmalig pro Nutzer) und
// speichert die ID am Profil — sowohl der Webhook als auch confirmSubscription
// (unten) brauchen diese Zuordnung.
async function getOrCreateStripeCustomerId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  email: string | undefined,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

export type SubscriptionIntentResult =
  | { ok: true; clientSecret: string; subscriptionId: string }
  | { ok: false; error: string };

// Erzeugt ein Abo im Status "incomplete" und gibt das zugehörige PaymentIntent-
// Client-Secret zurück — das Payment Element (PremiumCheckoutForm) sammelt
// die Zahlungsdaten direkt eingebettet im eigenen UI, statt zu Stripes
// gehosteter Checkout-Seite umzuleiten.
export async function createSubscriptionIntent(): Promise<SubscriptionIntentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Bitte melde dich zuerst an." };

  const customerId = await getOrCreateStripeCustomerId(supabase, user.id, user.email);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID! }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.confirmation_secret"],
  });

  // Aktuelle Stripe-API-Version: das PaymentIntent-Client-Secret hängt nicht
  // mehr direkt am Invoice (invoice.payment_intent existiert nicht mehr),
  // sondern unter invoice.confirmation_secret.
  const invoice = subscription.latest_invoice;
  const clientSecret =
    invoice && typeof invoice === "object" ? (invoice.confirmation_secret?.client_secret ?? null) : null;

  if (!clientSecret) {
    return { ok: false, error: "Zahlung konnte nicht vorbereitet werden." };
  }

  return { ok: true, clientSecret, subscriptionId: subscription.id };
}

// Nach erfolgreicher Bestätigung des Payment Elements im Browser (kein
// Redirect nötig) wird der Abo-Status direkt bei Stripe verifiziert, statt
// sich allein auf das Webhook-Event zu verlassen (siehe Begründung in der
// vorherigen Checkout-Variante — funktioniert unabhängig davon, ob Stripe
// diese lokale Dev-Umgebung per Webhook erreichen kann).
export async function confirmSubscription(subscriptionId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, ist_premium")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.ist_premium) return true;
  if (!profile?.stripe_customer_id) return false;

  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
  } catch {
    return false;
  }

  // Kein Gratis-Testzeitraum konfiguriert — "trialing" hier bewusst NICHT
  // akzeptiert (im Gegensatz zum Webhook-Handler, der auch künftige
  // Trial-Konfigurationen abdecken soll). "active" allein reicht aus, aber
  // zusätzlich prüfen wir, dass die zugehörige Rechnung tatsächlich bezahlt
  // wurde, statt uns allein auf das Subscription-Status-Feld zu verlassen.
  if (subscription.status !== "active") return false;
  if (subscription.customer !== profile.stripe_customer_id) return false;

  const invoice = subscription.latest_invoice;
  const invoicePaid = invoice && typeof invoice === "object" && invoice.status === "paid";
  if (!invoicePaid) return false;

  const { error } = await supabase.from("profiles").update({ ist_premium: true }).eq("id", user.id);
  if (error) return false;

  revalidatePath("/profil");
  revalidatePath("/profil/privatsphaere");
  return true;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Stripes gehostetes Kundenportal — dort verwaltet/kündigt der Nutzer sein
// Abo selbst, keine eigene UI dafür nötig (im Gegensatz zum Checkout selbst
// lohnt sich der Aufwand einer eigenen Portal-Nachbildung nicht).
export async function createPortalSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) redirect("/profil");

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl()}/profil`,
  });

  redirect(session.url);
}
