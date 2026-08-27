import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import ModerationActions from "@/components/ModerationActions";
import { createClient } from "@/lib/supabase/server";
import { isModerator, getPendingRoutes } from "@/lib/moderation";

export default async function ModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");
  if (!(await isModerator(user.id))) redirect("/");

  const routes = await getPendingRoutes();

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-6 py-10">
        <div>
          <h1 className="text-xl font-semibold">Moderation</h1>
          <p className="text-sm text-[#8A8F98]">
            {routes.length} unveröffentlichte Streckenvorschläge
          </p>
        </div>

        {routes.length === 0 ? (
          <p className="text-sm text-[#8A8F98]">Keine offenen Vorschläge.</p>
        ) : (
          <ul className="flex flex-col">
            {routes.map((route) => (
              <li
                key={route.id}
                className="flex flex-col gap-3 border-b border-[#131316]/10 py-4"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <Link href={`/strecken/${route.id}`} className="font-medium hover:text-[#3D5AFE]">
                      {route.name}
                    </Link>
                    <p className="text-sm text-[#8A8F98]">
                      {route.region} · {route.start_ort} → {route.ziel_ort} ·{" "}
                      <span className="font-mono tabular-nums">{route.laenge_km} km</span>
                    </p>
                  </div>
                </div>
                {route.charakter_text && (
                  <p className="text-sm text-[#131316]">{route.charakter_text}</p>
                )}
                <ModerationActions routeId={route.id} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
