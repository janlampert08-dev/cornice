import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";
import { getNavItems } from "@/lib/nav";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";

export default async function Header({ back }: { back?: string } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const moderator = user ? await isModerator(user.id) : false;
  // "/" wird hier ausgelassen — das Logo verlinkt bereits dorthin, ein
  // zweiter Link wäre redundant. Einzige Quelle der Nav-Items: lib/nav.ts,
  // von BottomNav (Mobile) genauso genutzt.
  const items = getNavItems({ loggedIn: !!user, moderator }).filter((item) => item.href !== "/");

  return (
    <>
      {/* sticky + Transluzenz/Blur statt eines deckenden Balkens — das
          "durchscheinende", beim Scrollen fixierte Nav-Bar-Verhalten ist ein
          der auffälligsten iOS-Systemmuster (Safari, Mail, Einstellungen). */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-foreground/10 bg-background/85 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {back && <BackButton fallbackHref={back} />}
          <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
            Cornice
          </Link>
        </div>
        {/* Auf Mobile übernimmt BottomNav die Navigation — hier nur noch auf
            Desktop sichtbar, um die Tab-Leiste nicht zu duplizieren. */}
        <nav className="hidden items-center gap-3 overflow-x-auto text-sm sm:gap-6 md:flex">
          {items.map((item) =>
            item.href === "/anmelden" ? (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-foreground px-4 py-1.5 text-foreground shadow-sm transition-transform hover:bg-foreground hover:text-background active:scale-95"
              >
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-foreground hover:text-accent"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </header>
      <BottomNav loggedIn={!!user} moderator={moderator} />
    </>
  );
}
