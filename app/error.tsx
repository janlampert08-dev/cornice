"use client";

import StatusPage from "@/components/ui/StatusPage";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPage
      title="Etwas ist schiefgelaufen."
      description="Die Daten konnten nicht geladen werden. Bitte versuche es erneut."
      actions={[
        { label: "Erneut versuchen", onClick: reset },
        { label: "Zur Übersicht", href: "/", variant: "secondary" },
      ]}
    >
      {/* Temporär zur Fehlersuche (Bug: "h.map is not a function" auf
          /strecken/[id]) — zeigt, ob ein Absturz hier serverseitig (mit
          digest, in Vercels Logs auffindbar) oder rein clientseitig
          passiert ist (kein digest, dafür die echte Fehlermeldung, die
          Server-Logs nie sehen). Entfernen, sobald der Bug gefunden ist. */}
      <p className="mt-2 max-w-sm font-mono text-xs break-words text-muted/70">
        {error.digest ? `digest: ${error.digest}` : error.message || "(keine Fehlermeldung)"}
      </p>
    </StatusPage>
  );
}
