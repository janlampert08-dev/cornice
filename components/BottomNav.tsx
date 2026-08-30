"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPinIcon, RankingIcon, PersonIcon, ShieldIcon } from "@/components/NavIcons";

// Nur auf schmalen Viewports sichtbar (md:hidden) — ersetzt dort die
// horizontale Header-Navigation durch die auf iOS/Strava übliche fixierte
// Bottom-Tab-Bar. safe-area-Padding unten, damit sie auf iPhones mit
// Home-Indicator nicht daran klebt (siehe viewport-fit=cover in layout.tsx).
export default function BottomNav({
  loggedIn,
  moderator,
}: {
  loggedIn: boolean;
  moderator: boolean;
}) {
  const pathname = usePathname();

  const tabs = loggedIn
    ? [
        { href: "/", label: "Strecken", icon: MapPinIcon },
        { href: "/leaderboards", label: "Ranglisten", icon: RankingIcon },
        { href: "/profil", label: "Profil", icon: PersonIcon },
        ...(moderator ? [{ href: "/moderation", label: "Moderation", icon: ShieldIcon }] : []),
      ]
    : [
        { href: "/", label: "Strecken", icon: MapPinIcon },
        { href: "/anmelden", label: "Anmelden", icon: PersonIcon },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#131316]/10 bg-[#FAFAFA]/85 pb-[var(--safe-bottom)] backdrop-blur-xl md:hidden"
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
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium"
            >
              <Icon
                className={`h-6 w-6 transition-colors ${active ? "text-[#3D5AFE]" : "text-[#8A8F98]"}`}
              />
              <span className={active ? "text-[#3D5AFE]" : "text-[#8A8F98]"}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
