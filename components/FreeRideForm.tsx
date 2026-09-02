"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { logFreeRide, type FreeRideFormState } from "@/lib/actions/completions";
import { useRideRecorder } from "@/components/useRideRecorder";
import { FREE_RIDE_STORAGE_KEY } from "@/lib/trackingStorage";
import RideSummaryForm from "@/components/RideSummaryForm";
import { formatDuration } from "@/lib/format";
import { movingSeconds, publicationBlockReason } from "@/lib/track";
import type { Vehicle } from "@/types/database";
import { fieldClassName } from "@/components/ui/Input";
import { buttonVariants } from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";

// Siehe ExploreView.tsx für die Begründung des dynamischen Imports.
const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const initialState: FreeRideFormState = { error: null };
const MAX_TITEL_LENGTH = 80;
// Ohne Strecke gibt es nichts, worauf sich die Karte beim Aufbau legen
// könnte — sie folgt stattdessen dem ersten ermittelten Standort.
const EMPTY_ROUTES: never[] = [];

// Aufzeichnung einer freien Fahrt: kein Streckenbezug, also kein
// automatischer Start am Startpunkt, kein automatischer Stopp am Ziel und
// kein Deckungsgrad. Gestartet wird mit dem ersten GPS-Fix, beendet von
// Hand. GPS-Mechanik (useRideRecorder) und Fazit-Formular
// (RideSummaryForm) teilt sich diese Ansicht mit LiveTrackingForm.
export default function FreeRideForm({
  userId,
  vehicles,
}: {
  // Nur für den localStorage-Schlüssel der Wiederherstellung — die Fahrt
  // selbst wird serverseitig dem angemeldeten Nutzer zugeordnet.
  userId: string;
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(logFreeRide, initialState);
  const recorder = useRideRecorder({ userId, storageKey: FREE_RIDE_STORAGE_KEY });
  const { phase, result, clearSnapshot, discard } = recorder;

  const [titel, setTitel] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Dieselbe Prüfung wie im Server (logFreeRide): eine zu kurze Aufzeichnung
  // lässt sich speichern, aber nicht teilen. Die Bewegtzeit wird hier aus
  // demselben Trail berechnet, den das Formular ohnehin mitschickt — der
  // Server rechnet sie unabhängig noch einmal nach.
  const publicationBlocked = useMemo(() => {
    if (!result) return null;
    return publicationBlockReason(result.distanceKm, movingSeconds(recorder.finishedTrail));
  }, [result, recorder.finishedTrail]);

  // Nach dem Speichern direkt auf die neue Fahrt — anders als bei einer
  // Streckenfahrt gibt es keine Seite, zu der man "zurück" könnte.
  useEffect(() => {
    if (submitted && !pending && !state.error && state.completionId) {
      clearSnapshot();
      router.push(`/fahrten/${state.completionId}`);
    }
  }, [submitted, pending, state.error, state.completionId, clearSnapshot, router]);

  function handleExit() {
    discard();
    router.push("/");
  }

  if (phase === "finished") {
    const avgKmh =
      result && result.seconds > 0 ? result.distanceKm / (result.seconds / 3600) : null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 py-8 sm:px-6 sm:py-10">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Fazit</h2>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">Distanz</dt>
              <dd className="font-mono text-lg tabular-nums">{result?.distanceKm.toFixed(2)} km</dd>
            </div>
            <div>
              <dt className="text-muted">Zeit</dt>
              <dd className="font-mono text-lg tabular-nums">
                {formatDuration(result?.seconds ?? 0)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Ø Tempo</dt>
              <dd className="font-mono text-lg tabular-nums">
                {avgKmh !== null ? `${avgKmh.toFixed(0)} km/h` : "—"}
              </dd>
            </div>
          </dl>

          <RideSummaryForm
            formAction={formAction}
            pending={pending}
            error={state.error}
            vehicles={vehicles}
            trailJson={recorder.trailJson}
            visibility={{
              publicDisabled: publicationBlocked !== null,
              publicDisabledHint: publicationBlocked ?? undefined,
              publicHint:
                "Öffentlich: erscheint im Feed und auf deinem öffentlichen Profil. Start und Ziel werden auf der Karte gekappt (Privatzone in den Einstellungen). Später jederzeit umschaltbar.",
              privateHint:
                "Privat: nur du siehst diese Fahrt in deinem Profil, für andere bleibt sie unsichtbar. Später jederzeit umschaltbar.",
            }}
            isPublic={isPublic}
            onIsPublicChange={setIsPublic}
            onSubmit={() => setSubmitted(true)}
            onDiscard={handleExit}
          >
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="freie-fahrt-titel"
                  className="text-xs font-semibold tracking-wide text-muted uppercase"
                >
                  Titel (optional)
                </label>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {titel.length}/{MAX_TITEL_LENGTH}
                </span>
              </div>
              <input
                id="freie-fahrt-titel"
                name="titel"
                type="text"
                maxLength={MAX_TITEL_LENGTH}
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                placeholder="z.B. Sonntagsrunde Zürichsee"
                className={fieldClassName()}
              />
            </div>
          </RideSummaryForm>
        </div>
      </div>
    );
  }

  // phase "idle" und "tracking" teilen sich denselben Vollbild-Screen: die
  // Aufzeichnung läuft ab dem ersten Fix, bis dahin steht nur die Karte da.
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="min-h-0 flex-1">
        <RouteMap
          routes={EMPTY_ROUTES}
          trail={recorder.liveTrail}
          centerOnFirstLocation
          userLocation={recorder.position}
          userAccuracyM={recorder.accuracyM}
          userHeadingDeg={recorder.headingDeg}
        />
      </div>
      <div className="flex flex-col gap-3 border-t border-border-strong bg-background p-4 pb-[calc(1rem+var(--safe-bottom))]">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          {recorder.hasStarted ? "Aufzeichnung läuft" : "Warte auf GPS"}
        </p>
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-muted">Distanz</dt>
            <dd className="font-mono text-xl tabular-nums">{recorder.distanceKm.toFixed(2)} km</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Zeit</dt>
            <dd className="font-mono text-xl tabular-nums">
              {formatDuration(recorder.elapsedSeconds)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Tempo</dt>
            <dd className="font-mono text-lg tabular-nums">
              {recorder.speedKmh !== null ? `${recorder.speedKmh.toFixed(0)} km/h` : "—"}
            </dd>
          </div>
        </dl>
        {recorder.locationError && <p className="text-sm text-danger">{recorder.locationError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {recorder.hasStarted ? (
            <button
              type="button"
              onClick={recorder.stop}
              className={buttonVariants({ variant: "accent" })}
            >
              Fahrt beenden
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExit}
              className={buttonVariants({ variant: "secondary" })}
            >
              Abbrechen
            </button>
          )}
          <p className="text-xs text-muted">
            Bildschirm eingeschaltet lassen — GPS-Tracking im Browser pausiert sonst.
          </p>
        </div>
      </div>
    </div>
  );
}
