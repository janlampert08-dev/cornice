import Link from "next/link";
import { createPortalSession } from "@/lib/actions/billing";
import TrophyBadge from "@/components/TrophyBadge";

export default function PremiumCard({ istPremium }: { istPremium: boolean }) {
  return (
    <section className="flex flex-col gap-3 border border-[#131316]/20 bg-[#131316]/[0.03] px-4 py-4">
      <div className="flex items-center gap-2">
        <TrophyBadge className="h-4 w-4" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">Premium</h2>
      </div>
      {istPremium ? (
        <>
          <p className="text-sm text-[#131316]">Du bist Premium-Mitglied.</p>
          <form action={createPortalSession}>
            <button
              type="submit"
              className="self-start border border-[#131316]/30 px-4 py-2 text-sm text-[#131316] hover:border-[#131316]"
            >
              Abo verwalten
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-[#8A8F98]">
            CHF 4.90/Monat — eigene private Strecken ohne Moderationspflicht, dezentes
            Premium-Symbol neben deinem Namen und mehr.
          </p>
          <Link
            href="/profil/premium"
            className="self-start border border-[#131316] bg-[#131316] px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90"
          >
            Premium werden
          </Link>
        </>
      )}
    </section>
  );
}
