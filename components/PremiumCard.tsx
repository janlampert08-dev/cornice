import Link from "next/link";
import { createPortalSession } from "@/lib/actions/billing";

export default function PremiumCard({ istPremium }: { istPremium: boolean }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[#131316]/15 shadow-sm bg-[#131316]/[0.03] px-4 py-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8A8F98]">Premium</h2>
      {istPremium ? (
        <>
          <p className="text-sm text-[#131316]">Du bist Premium-Mitglied.</p>
          <form action={createPortalSession}>
            <button
              type="submit"
              className="self-start rounded-xl border border-[#131316]/20 px-4 py-2 text-sm text-[#131316] hover:border-[#131316]"
            >
              Abo verwalten
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-sm text-[#8A8F98]">
            CHF 4.90/Monat — eigene private Strecken ohne Moderationspflicht, dein Name in Gold auf
            Bestenlisten und mehr.
          </p>
          <Link
            href="/profil/premium"
            className="self-start rounded-full border border-[#131316] bg-[#131316] shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-[#FAFAFA] hover:opacity-90"
          >
            Premium werden
          </Link>
        </>
      )}
    </section>
  );
}
