import Header from "@/components/Header";
import NeuesFahrzeugForm from "@/components/NeuesFahrzeugForm";

export default function NeuesFahrzeugPage() {
  return (
    <div className="flex h-dvh flex-col">
      <Header back="/profil" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
        <NeuesFahrzeugForm />
      </main>
    </div>
  );
}
