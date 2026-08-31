import Header from "@/components/Header";
import ExploreView from "@/components/ExploreView";
import { getRoutes } from "@/lib/routes";
import { getRouteCoverPhotos } from "@/lib/photos";

export default async function Home() {
  const { routes, error } = await getRoutes();
  // Ein Batch-Query statt einem Request pro Strecke — siehe
  // getRouteCoverPhotos in lib/photos.ts.
  const coverPhotos = await getRouteCoverPhotos(routes.map((r) => r.id));

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <ExploreView routes={routes} loadError={error} coverPhotos={coverPhotos} />
    </div>
  );
}
