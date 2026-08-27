import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";
import BackButton from "@/components/BackButton";

export default async function Header({ back }: { back?: string } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const moderator = user ? await isModerator(user.id) : false;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#131316]/10 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        {back && <BackButton fallbackHref={back} />}
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          Cornice
        </Link>
      </div>
      <nav className="flex items-center gap-3 overflow-x-auto text-sm sm:gap-6">
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
            <Link href="/profil" className="whitespace-nowrap text-[#131316] hover:text-[#3D5AFE]">
              Profil
            </Link>
          </>
        ) : (
          <Link
            href="/anmelden"
            className="whitespace-nowrap border border-[#131316] px-3 py-1.5 text-[#131316] hover:bg-[#131316] hover:text-[#FAFAFA]"
          >
            Anmelden
          </Link>
        )}
      </nav>
    </header>
  );
}
