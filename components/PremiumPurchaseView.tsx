"use client";

import { useRouter } from "next/navigation";
import TrophyBadge from "@/components/TrophyBadge";
import PremiumCheckoutForm from "@/components/PremiumCheckoutForm";

export default function PremiumPurchaseView() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <TrophyBadge className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Premium werden</h1>
      </div>
      <p className="text-sm text-[#8A8F98]">
        CHF 4.90/Monat — eigene private Strecken ohne Moderationspflicht, dezentes Premium-Symbol
        neben deinem Namen und mehr.
      </p>
      <PremiumCheckoutForm onSuccess={() => router.push("/profil")} />
    </div>
  );
}
