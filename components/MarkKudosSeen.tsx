"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markKudosSeen } from "@/lib/actions/kudos";

// Setzt beim Laden des eigenen Profils profiles.kudos_gesehen_am auf jetzt
// (siehe mark_kudos_seen, 0053_kudos_gesehen.sql) — Grundlage für den
// Ungelesen-Kudos-Zähler in Header/BottomNav (lib/kudos.ts,
// getUnseenKudosCount). router.refresh() holt Header danach neu, damit der
// Zähler sofort verschwindet statt erst bei der nächsten Navigation.
export default function MarkKudosSeen() {
  const router = useRouter();

  useEffect(() => {
    markKudosSeen().then(({ ok }) => {
      if (ok) router.refresh();
    });
  }, [router]);

  return null;
}
