"use client";

import { useState, useTransition } from "react";
import { toggleCompletionVisibility } from "@/lib/actions/completions";
import { GlobeIcon, LockIcon } from "@/components/VisibilityIcons";
import { COVERAGE_THRESHOLD_PERCENT } from "@/lib/routeCoverage";
import Card from "@/components/ui/Card";

export default function RideVisibilityToggle({
  completionId,
  isPublic,
  coveragePercent,
}: {
  completionId: string;
  isPublic: boolean;
  coveragePercent: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const belowThreshold = coveragePercent < COVERAGE_THRESHOLD_PERCENT;
  const blocked = !isPublic && belowThreshold;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={
          isPublic
            ? "Öffentlich — auf Bestenlisten/Profil sichtbar. Klicken um privat zu machen."
            : blocked
              ? `Kann nicht öffentlich gemacht werden — deckt nur ${Math.round(coveragePercent)}% der Strecke ab.`
              : "Privat — nur für dich sichtbar. Klicken um öffentlich zu machen."
        }
        disabled={pending || blocked}
        onClick={() =>
          startTransition(async () => {
            const result = await toggleCompletionVisibility(completionId);
            setError(result.error);
          })
        }
        className="text-muted transition-colors duration-fast hover:text-accent disabled:opacity-30"
      >
        {isPublic ? <GlobeIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
      </button>
      {error && (
        <Card
          elevated
          className="absolute top-full right-0 z-10 mt-1 w-48 p-2 text-right text-xs text-danger"
        >
          {error}
        </Card>
      )}
    </div>
  );
}
