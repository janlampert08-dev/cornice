"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavItems } from "@/lib/nav";

// Nur auf schmalen Viewports sichtbar (md:hidden) — ersetzt dort die
// horizontale Header-Navigation durch die auf iOS/Strava übliche fixierte
// Bottom-Tab-Bar. safe-area-Padding unten, damit sie auf iPhones mit
// Home-Indicator nicht daran klebt (siehe viewport-fit=cover in layout.tsx).
export default function BottomNav({
  loggedIn,
  moderator,
  unseenKudosCount = 0,
}: {
  loggedIn: boolean;
  moderator: boolean;
  // Rückkanal für "Community reagiert" im Kernloop (siehe Header.tsx) — auf
  // dem Profil-Tab statt einer eigenen Notifications-Seite, da es (noch)
  // keine gibt.
  unseenKudosCount?: number;
}) {
  const pathname = usePathname();
  const tabs = getNavItems({ loggedIn, moderator, surface: "bottom" });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(var(--safe-bottom), 0px)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
            >
              <span className="relative">
                <Icon
                  className={`h-6 w-6 transition-colors duration-fast ${active ? "text-accent" : "text-muted"}`}
                />
                {tab.href === "/profil" && unseenKudosCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-background">
                    {unseenKudosCount > 9 ? "9+" : unseenKudosCount}
                  </span>
                )}
              </span>
              <span className={`transition-colors duration-fast ${active ? "text-accent" : "text-muted"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
