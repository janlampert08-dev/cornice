import type { ComponentType } from "react";
import { Compass, Mountain, TrendingUp } from "lucide-react";
import Card from "@/components/ui/Card";

const PASS_MILESTONES = [1, 5, 10, 25, 50, 100];
const HOEHENMETER_MILESTONES = [1000, 5000, 10000, 25000, 50000];
const FAHRTEN_MILESTONES = [1, 10, 25, 50, 100];

function highestMilestone(value: number, milestones: number[]): number | null {
  const reached = milestones.filter((m) => value >= m);
  return reached.length > 0 ? reached[reached.length - 1] : null;
}

interface Badge {
  icon: ComponentType<{ className?: string }>;
  label: string;
}

// Reine Darstellung bereits auf der Seite berechneter Zahlen (passCount/
// hoehenmeter/trackedRides.length aus app/profil/page.tsx) — keine neuen
// Queries, keine an Premium gekoppelte Freischaltung. Zeigt je Kategorie nur
// die höchste erreichte Schwelle, damit die Kachelreihe klein bleibt.
export default function AchievementBadges({
  passCount,
  hoehenmeter,
  fahrtenCount,
}: {
  passCount: number;
  hoehenmeter: number;
  fahrtenCount: number;
}) {
  const badges: Badge[] = [];

  const passMilestone = highestMilestone(passCount, PASS_MILESTONES);
  if (passMilestone !== null) {
    badges.push({ icon: Mountain, label: `${passMilestone} Pässe` });
  }

  const hoehenmeterMilestone = highestMilestone(hoehenmeter, HOEHENMETER_MILESTONES);
  if (hoehenmeterMilestone !== null) {
    badges.push({ icon: TrendingUp, label: `${hoehenmeterMilestone.toLocaleString("de-CH")} Höhenmeter` });
  }

  const fahrtenMilestone = highestMilestone(fahrtenCount, FAHRTEN_MILESTONES);
  if (fahrtenMilestone !== null) {
    badges.push({ icon: Compass, label: `${fahrtenMilestone} Fahrten` });
  }

  if (badges.length === 0) {
    return (
      <p className="text-sm text-muted">
        Noch keine Auszeichnungen — die erste Fahrt eintragen, um loszulegen.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {badges.map((badge) => (
        <Card
          key={badge.label}
          surface
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium"
        >
          <badge.icon className="h-4 w-4 text-accent" aria-hidden="true" />
          {badge.label}
        </Card>
      ))}
    </div>
  );
}
