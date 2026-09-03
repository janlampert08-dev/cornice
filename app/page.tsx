import Header from "@/components/Header";
import ExploreView from "@/components/ExploreView";
import { getRoutes } from "@/lib/routes";

export default async function Home() {
  const { routes, error } = await getRoutes();

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <ExploreView routes={routes} loadError={error} />
    </div>
  );
}
