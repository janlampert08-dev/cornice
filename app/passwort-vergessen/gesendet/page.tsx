import Header from "@/components/Header";

export default function PasswortVergessenGesendetPage() {
  return (
    <div className="flex h-dvh flex-col">
      <Header back="/anmelden" />
      <main className="mx-auto flex max-w-sm flex-1 flex-col items-start justify-center gap-3 px-6">
        <h1 className="text-display font-semibold">E-Mail unterwegs</h1>
        <p className="text-sm text-muted">
          Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum
          Zurücksetzen deines Passworts geschickt.
        </p>
      </main>
    </div>
  );
}
