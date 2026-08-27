"use client";

import { useState, useTransition } from "react";
import { toggleCompletionVisibility } from "@/lib/actions/completions";
import { GlobeIcon, LockIcon } from "@/components/VisibilityIcons";
import { COVERAGE_THRESHOLD_PERCENT } from "@/lib/routeCoverage";

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
        className="text-[#8A8F98] transition-colors duration-150 hover:text-[#3D5AFE] disabled:opacity-30"
      >
        {isPublic ? <GlobeIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
      </button>
      {error && (
        <p className="absolute right-0 top-full z-10 mt-1 w-48 border border-[#131316]/20 bg-[#FAFAFA] p-2 text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
