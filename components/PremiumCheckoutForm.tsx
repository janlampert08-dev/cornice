"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripeClient";
import { createSubscriptionIntent, confirmSubscription } from "@/lib/actions/billing";

// "flat"-Theme + borderRadius: 0 spiegelt exakt das bestehende, radiuslose
// Design-System — kein Stripe-Branding-Look, sondern ein eingebettetes
// Formular, das wie ein normales Cornice-Formularfeld wirkt.
const APPEARANCE: StripeElementsOptions["appearance"] = {
  theme: "flat",
  variables: {
    colorPrimary: "#3D5AFE",
    colorBackground: "#FAFAFA",
    colorText: "#131316",
    colorTextSecondary: "#8A8F98",
    colorDanger: "#DC2626",
    fontFamily: "'Inter', sans-serif",
    fontSizeBase: "14px",
    borderRadius: "0px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(19,19,22,0.3)",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #3D5AFE",
      boxShadow: "none",
    },
    ".Label": {
      color: "#8A8F98",
      fontSize: "12px",
    },
    ".Tab": {
      border: "1px solid rgba(19,19,22,0.3)",
      borderRadius: "0px",
    },
    ".Tab--selected": {
      border: "1px solid #3D5AFE",
      boxShadow: "none",
    },
  },
};

// Das Payment Element läuft in einem eigenen Iframe — fontFamily allein
// erreicht dort kein "inherit" vom Elternfenster. Stripes fonts-Option lädt
// dieselbe Schrift (Inter, wie im Rest von Cornice via next/font) direkt im
// Iframe, sonst würde ein Browser-Standardfont durchscheinen.
const FONTS: NonNullable<StripeElementsOptions["fonts"]> = [
  {
    cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  },
];

function CheckoutInner({
  subscriptionId,
  onSuccess,
}: {
  subscriptionId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    // redirect: "if_required" hält den Nutzer im eingebetteten Formular,
    // solange keine 3-D-Secure-Weiterleitung zwingend nötig ist.
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message ?? "Zahlung fehlgeschlagen.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
      const confirmed = await confirmSubscription(subscriptionId);
      if (confirmed) {
        onSuccess();
        return;
      }
      setError(
        "Zahlung erfolgt, Premium-Status konnte aber nicht bestätigt werden — lade die Seite neu.",
      );
    } else {
      setError("Zahlung konnte nicht abgeschlossen werden.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="self-start border border-[#131316] bg-[#131316] px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Wird verarbeitet…" : "CHF 4.90/Monat abonnieren"}
      </button>
    </form>
  );
}

type IntentState = { clientSecret: string; subscriptionId: string } | { error: string } | null;

export default function PremiumCheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, setState] = useState<IntentState>(null);

  useEffect(() => {
    let cancelled = false;
    createSubscriptionIntent().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { clientSecret: result.clientSecret, subscriptionId: result.subscriptionId }
          : { error: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return <p className="text-sm text-[#8A8F98]">Zahlung wird vorbereitet…</p>;
  }

  if ("error" in state) {
    return <p className="text-sm text-red-600">{state.error}</p>;
  }

  return (
    <Elements
      stripe={getStripe()}
      options={{ clientSecret: state.clientSecret, appearance: APPEARANCE, fonts: FONTS }}
    >
      <CheckoutInner subscriptionId={state.subscriptionId} onSuccess={onSuccess} />
    </Elements>
  );
}
