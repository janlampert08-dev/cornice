"use client";

import { useRouter } from "next/navigation";
import PremiumCheckoutForm from "@/components/PremiumCheckoutForm";

export default function PremiumPurchaseView() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Premium werden</h1>
      <p className="text-sm text-[#8A8F98]">
        CHF 4.90/Monat — eigene private Strecken ohne Moderationspflicht, dein Name in Gold auf
        Bestenlisten und mehr.
      </p>
      <PremiumCheckoutForm onSuccess={() => router.push("/profil")} />
    </div>
  );
}
