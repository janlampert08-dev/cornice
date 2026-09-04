import Header from "@/components/Header";
import AnmeldenForm from "@/components/AnmeldenForm";
import { LEGAL_URLS } from "@/lib/constants";

export const metadata = { title: "Anmelden – Cornice" };

export default function AnmeldenPage() {
  return (
    <div className="flex h-dvh flex-col">
      <Header back="/" />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
        <AnmeldenForm />
      </main>
      <p className="pb-6 text-center text-xs text-muted/50">
        <a
          href={LEGAL_URLS.impressum}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-fast hover:text-muted"
        >
          Impressum
        </a>{" "}
        &{" "}
        <a
          href={LEGAL_URLS.datenschutz}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors duration-fast hover:text-muted"
        >
          Datenschutz
        </a>
      </p>
    </div>
  );
}
