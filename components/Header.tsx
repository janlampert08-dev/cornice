import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";
import { getUnseenKudosCount } from "@/lib/kudos";
import { getNavItems } from "@/lib/nav";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";
import { buttonVariants } from "@/components/ui/Button";

export default async function Header({ back }: { back?: string } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const moderator = user ? await isModerator(user.id) : false;
  // Rückkanal für "Community reagiert" im Kernloop (siehe AGENTS.md, "Core
  // User Loop") — ohne diesen Zähler erfährt der Fahrer sonst nie aktiv,
  // dass eine geteilte Fahrt Kudos bekommen hat.
  const unseenKudosCount = user ? await getUnseenKudosCount() : 0;
  // "/" wird hier ausgelassen — das Logo verlinkt bereits dorthin, ein
  // zweiter Link wäre redundant. Einzige Quelle der Nav-Items: lib/nav.ts,
  // von BottomNav (Mobile) genauso genutzt.
  const items = getNavItems({ loggedIn: !!user, moderator }).filter((item) => item.href !== "/");

  return (
    <>
      {/* sticky + Transluzenz/Blur statt eines deckenden Balkens — das
          "durchscheinende", beim Scrollen fixierte Nav-Bar-Verhalten ist ein
          der auffälligsten iOS-Systemmuster (Safari, Mail, Einstellungen). */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {back && <BackButton fallbackHref={back} />}
          <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
            Cornice
          </Link>
        </div>
        {/* Auf Mobile übernimmt BottomNav die Navigation — hier nur noch auf
            Desktop sichtbar, um die Tab-Leiste nicht zu duplizieren. Die
            Hell/Dunkel-Wahl (vormals hier als eigenes Icon) wohnt jetzt
            ausschliesslich im Darstellung-Tab der Einstellungen
            (app/profil/einstellungen); ohne manuelle Wahl gilt weiterhin
            "System" als Standard. */}
        <nav className="hidden shrink-0 items-center gap-3 overflow-x-auto text-sm sm:gap-6 md:flex">
          {items.map((item) =>
            item.href === "/anmelden" ? (
              <Link
                key={item.href}
                href={item.href}
                className={buttonVariants({ variant: "primary", size: "sm", className: "whitespace-nowrap" })}
              >
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 whitespace-nowrap text-foreground transition-colors duration-fast hover:text-accent"
              >
                {item.label}
              </Link>
            ),
          )}
          {/* Nur auf Desktop, siehe BottomNav.tsx — eine sechste Kachel dort
              wäre auf schmalen Geräten zu eng (lib/nav.ts), deshalb bleibt
              der Rückkanal für "Community reagiert" auf Mobile vorerst beim
              Badge auf dem Profil-Tab. */}
          {user && (
            <Link
              href="/aktivitaet"
              className="flex items-center gap-1.5 whitespace-nowrap text-foreground transition-colors duration-fast hover:text-accent"
            >
              Aktivität
              {unseenKudosCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-background">
                  {unseenKudosCount > 9 ? "9+" : unseenKudosCount}
                </span>
              )}
            </Link>
          )}
        </nav>
      </header>
      <BottomNav loggedIn={!!user} moderator={moderator} unseenKudosCount={unseenKudosCount} />
    </>
  );
}
