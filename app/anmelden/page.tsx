import Header from "@/components/Header";
import AnmeldenForm from "@/components/AnmeldenForm";

export default function AnmeldenPage() {
  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
        <AnmeldenForm />
      </main>
    </div>
  );
}
