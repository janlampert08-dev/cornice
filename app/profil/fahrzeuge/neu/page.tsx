import Header from "@/components/Header";
import NeuesFahrzeugForm from "@/components/NeuesFahrzeugForm";
import { safeInternalPath } from "@/lib/utils/url";

// ?next steuert, wohin's nach dem Speichern zurückgeht — z. B. zurück zur
// Onboarding-Checkliste auf der Startseite (components/
// OnboardingChecklist.tsx), statt immer fest zu /profil. Fehlt der
// Parameter oder zeigt er nicht auf einen internen Pfad, bleibt /profil der
// Standard (siehe safeInternalPath).
export default async function NeuesFahrzeugPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextHref = safeInternalPath(next) ?? "/profil";

  return (
    <div className="flex h-dvh flex-col">
      <Header back={nextHref} />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
        <NeuesFahrzeugForm nextHref={nextHref} />
      </main>
    </div>
  );
}
