import Header from "@/components/Header";

export default function BestaetigenPage() {
  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <main className="mx-auto flex max-w-sm flex-1 flex-col items-start justify-center gap-3 px-6">
        <h1 className="text-xl font-semibold">Fast geschafft</h1>
        <p className="text-sm text-muted">
          Wir haben dir eine Bestätigungs-E-Mail geschickt. Klicke auf den Link
          darin, um dein Konto zu aktivieren.
        </p>
      </main>
    </div>
  );
}
