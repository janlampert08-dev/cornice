import { NextResponse } from "next/server";
import { getRouteLeaderboard } from "@/lib/leaderboard";

// Liefert die (freiwillig geteilten) Bestzeiten einer Strecke — genutzt vom
// Strecken-Chooser auf /leaderboards, damit dieser nicht bei jedem Wechsel
// eine volle Serverkomponenten-Neuberechnung der ganzen Seite auslösen muss.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entries = await getRouteLeaderboard(id);
  return NextResponse.json({ entries });
}
