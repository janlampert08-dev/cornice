// Premium-UI ist vorerst deaktiviert (siehe components/PremiumCard.tsx) —
// aktuell nur noch von den auskommentierten components/PremiumCheckoutForm.tsx
// referenziert, bleibt aber unverändert bestehen, um Premium später ohne
// Backend-Änderungen reaktivieren zu können.
import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | undefined;

// Einmal geladen, wiederverwendet — loadStripe() selbst cached bereits
// intern, aber ein Modul-Singleton vermeidet unnötige Re-Registrierungen
// bei jedem Render von PremiumCheckoutForm.
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}
