import type { ComponentType } from "react";
import { MapPinIcon, PlusIcon, RankingIcon, PersonIcon, ShieldIcon, FeedIcon, RecordIcon } from "@/components/NavIcons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// Einzige Quelle für die Top-Level-Navigation — Header (Desktop) und
// BottomNav (Mobile) rendern beide dieselbe Liste.
//
// Ein Unterschied bleibt seit dem Aufzeichnen freier Fahrten: die mobile
// Leiste trägt an der mittleren, am leichtesten erreichbaren Position
// "Aufzeichnen" und dafür nicht mehr "Vorschlagen" (sechs Tabs wären auf
// schmalen Geräten zu eng, und der Weg zum Streckenvorschlag steht ohnehin
// prominent auf /profil). Der Header ist eine reine Textleiste mit
// horizontalem Überlauf — dort ist Platz für beides, also stehen dort auch
// beide.
export function getNavItems({
  loggedIn,
  moderator,
  surface = "header",
}: {
  loggedIn: boolean;
  moderator: boolean;
  surface?: "header" | "bottom";
}): NavItem[] {
  if (!loggedIn) {
    return [
      { href: "/", label: "Strecken", icon: MapPinIcon },
      { href: "/anmelden", label: "Anmelden", icon: PersonIcon },
    ];
  }

  const aufzeichnen: NavItem = { href: "/fahrten/neu", label: "Aufzeichnen", icon: RecordIcon };
  const vorschlagen: NavItem = { href: "/strecken/neu", label: "Vorschlagen", icon: PlusIcon };
  const mittlereAktionen: NavItem[] =
    surface === "bottom" ? [aufzeichnen] : [aufzeichnen, vorschlagen];

  return [
    { href: "/", label: "Strecken", icon: MapPinIcon },
    { href: "/feed", label: "Feed", icon: FeedIcon },
    ...mittlereAktionen,
    { href: "/leaderboards", label: "Bestenlisten", icon: RankingIcon },
    { href: "/profil", label: "Profil", icon: PersonIcon },
    ...(moderator ? [{ href: "/moderation", label: "Moderation", icon: ShieldIcon }] : []),
  ];
}
