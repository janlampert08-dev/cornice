// Premium-Feature vorerst vollständig deaktiviert — kein Upsell, keine
// Werbung, alle Funktionen für alle Nutzer zugänglich. Auskommentiert statt
// gelöscht, um das Feature bei Bedarf wieder zu aktivieren.
//
// import Link from "next/link";
// import { createPortalSession } from "@/lib/actions/billing";
//
// export default function PremiumCard({ istPremium }: { istPremium: boolean }) {
//   return (
//     <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-4">
//       <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Premium</h2>
//       {istPremium ? (
//         <>
//           <p className="text-sm text-foreground">Du bist Premium-Mitglied.</p>
//           <form action={createPortalSession}>
//             <button
//               type="submit"
//               className="self-start rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:border-border-strong"
//             >
//               Abo verwalten
//             </button>
//           </form>
//         </>
//       ) : (
//         <>
//           <p className="text-sm text-muted">
//             CHF 4.90/Monat — eigene private Strecken ohne Moderationspflicht, dein Name in Gold auf
//             Bestenlisten und mehr.
//           </p>
//           <Link
//             href="/profil/premium"
//             className="self-start rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform duration-fast active:scale-95 hover:opacity-90"
//           >
//             Premium werden
//           </Link>
//         </>
//       )}
//     </section>
//   );
// }
