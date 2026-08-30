import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";

export default async function Header({ back }: { back?: string } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const moderator = user ? await isModerator(user.id) : false;

  return (
    <>
      {/* sticky + Transluzenz/Blur statt eines deckenden Balkens — das
          "durchscheinende", beim Scrollen fixierte Nav-Bar-Verhalten ist ein
          der auffälligsten iOS-Systemmuster (Safari, Mail, Einstellungen). */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#131316]/10 bg-[#FAFAFA]/85 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {back && <BackButton fallbackHref={back} />}
          <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
            Cornice
          </Link>
        </div>
        {/* Auf Mobile übernimmt BottomNav die Navigation — hier nur noch auf
            Desktop sichtbar, um die Tab-Leiste nicht zu duplizieren. */}
        <nav className="hidden items-center gap-3 overflow-x-auto text-sm sm:gap-6 md:flex">
          {user ? (
            <>
              {moderator && (
                <Link
                  href="/moderation"
                  className="whitespace-nowrap text-[#131316] hover:text-[#3D5AFE]"
                >
                  Moderation
                </Link>
              )}
              <Link
                href="/leaderboards"
                className="whitespace-nowrap text-[#131316] hover:text-[#3D5AFE]"
              >
                Bestenlisten
              </Link>
              <Link
                href="/profil"
                className="whitespace-nowrap text-[#131316] hover:text-[#3D5AFE]"
              >
                Profil
              </Link>
            </>
          ) : (
            <Link
              href="/anmelden"
              className="whitespace-nowrap rounded-full border border-[#131316] px-4 py-1.5 text-[#131316] shadow-sm transition-transform hover:bg-[#131316] hover:text-[#FAFAFA] active:scale-95"
            >
              Anmelden
            </Link>
          )}
        </nav>
      </header>
      <BottomNav loggedIn={!!user} moderator={moderator} />
    </>
  );
}
