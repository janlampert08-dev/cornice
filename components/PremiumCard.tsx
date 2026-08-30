// Premium-Feature vorerst vollständig deaktiviert — kein Upsell, keine
// Werbung, alle Funktionen für alle Nutzer zugänglich. Auskommentiert statt
// gelöscht, um das Feature bei Bedarf wieder zu aktivieren.
//
// import Link from "next/link";
// import { createPortalSession } from "@/lib/actions/billing";
//
// export default function PremiumCard({ istPremium }: { istPremium: boolean }) {
//   return (
//     <section className="flex flex-col gap-3 rounded-xl border border-foreground/15 shadow-sm bg-foreground/[0.03] px-4 py-4">
//       <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Premium</h2>
//       {istPremium ? (
//         <>
//           <p className="text-sm text-foreground">Du bist Premium-Mitglied.</p>
//           <form action={createPortalSession}>
//             <button
//               type="submit"
//               className="self-start rounded-xl border border-foreground/20 px-4 py-2 text-sm text-foreground hover:border-foreground"
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
//             className="self-start rounded-full border border-foreground bg-foreground shadow-sm transition-transform active:scale-95 px-4 py-2 text-sm font-medium text-background hover:opacity-90"
//           >
//             Premium werden
//           </Link>
//         </>
//       )}
//     </section>
//   );
// }
