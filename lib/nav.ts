import type { ComponentType } from "react";
import { MapPinIcon, PlusIcon, RankingIcon, PersonIcon, ShieldIcon, FeedIcon } from "@/components/NavIcons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// Einzige Quelle für die Top-Level-Navigation — Header (Desktop) und
// BottomNav (Mobile) rendern beide dieselbe Liste, statt wie zuvor zwei
// unabhängig gepflegte Item-Arrays mit eigener Active-State-Logik zu haben.
export function getNavItems({
  loggedIn,
  moderator,
}: {
  loggedIn: boolean;
  moderator: boolean;
}): NavItem[] {
  if (!loggedIn) {
    return [
      { href: "/", label: "Strecken", icon: MapPinIcon },
      { href: "/anmelden", label: "Anmelden", icon: PersonIcon },
    ];
  }

  return [
    { href: "/", label: "Strecken", icon: MapPinIcon },
    { href: "/feed", label: "Feed", icon: FeedIcon },
    { href: "/strecken/neu", label: "Vorschlagen", icon: PlusIcon },
    { href: "/leaderboards", label: "Bestenlisten", icon: RankingIcon },
    { href: "/profil", label: "Profil", icon: PersonIcon },
    ...(moderator ? [{ href: "/moderation", label: "Moderation", icon: ShieldIcon }] : []),
  ];
}
