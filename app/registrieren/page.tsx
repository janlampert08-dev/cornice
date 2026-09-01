import Header from "@/components/Header";
import RegistrierenForm from "@/components/RegistrierenForm";

export const metadata = { title: "Registrieren – Cornice" };

export default function RegistrierenPage() {
  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
        <RegistrierenForm />
      </main>
    </div>
  );
}
