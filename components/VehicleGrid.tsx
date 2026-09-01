import { Bike, Car } from "lucide-react";
import type { Vehicle } from "@/types/database";
import DeleteVehicleButton from "@/components/DeleteVehicleButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

const TYP_ICON: Record<Vehicle["typ"], typeof Car> = {
  auto: Car,
  motorrad: Bike,
};

const GETRIEBE_LABEL: Record<Vehicle["getriebe"], string> = {
  manuell: "Manuell",
  automatik: "Automatik",
};

// Ersetzt die vorherige <table>-Darstellung (VehicleList.tsx) durch ein
// Kachel-Raster, konsistent mit den Stat-Kacheln auf derselben Seite
// (Card surface) statt einer eigenständigen Tabellen-Optik.
export default function VehicleGrid({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) {
    return <EmptyState icon={Car} title="Noch keine Fahrzeuge hinterlegt." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {vehicles.map((vehicle) => {
        const Icon = TYP_ICON[vehicle.typ];
        return (
          <Card
            key={vehicle.id}
            surface
            className="flex items-start gap-3 p-4"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
              <Icon className="h-5 w-5 text-muted" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate font-medium">
                {vehicle.marke} {vehicle.modell}
              </p>
              <p className="text-sm text-muted">
                {GETRIEBE_LABEL[vehicle.getriebe]}
                {vehicle.baujahr && ` · ${vehicle.baujahr}`}
              </p>
            </div>
            <DeleteVehicleButton vehicleId={vehicle.id} />
          </Card>
        );
      })}
    </div>
  );
}
