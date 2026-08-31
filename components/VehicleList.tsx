import { Car } from "lucide-react";
import type { Vehicle } from "@/types/database";
import DeleteVehicleButton from "@/components/DeleteVehicleButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

const TYP_LABEL: Record<Vehicle["typ"], string> = {
  auto: "Auto",
  motorrad: "Motorrad",
};

const GETRIEBE_LABEL: Record<Vehicle["getriebe"], string> = {
  manuell: "Manuell",
  automatik: "Automatik",
};

export default function VehicleList({ vehicles }: { vehicles: Vehicle[] }) {
  if (vehicles.length === 0) {
    return <EmptyState icon={Car} title="Noch keine Fahrzeuge hinterlegt." />;
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-left text-muted">
            <th className="px-3 py-2 font-normal">Typ</th>
            <th className="px-3 py-2 font-normal">Marke / Modell</th>
            <th className="px-3 py-2 font-normal">Getriebe</th>
            <th className="px-3 py-2 text-right font-normal">Baujahr</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">{TYP_LABEL[vehicle.typ]}</td>
              <td className="px-3 py-2">
                {vehicle.marke} {vehicle.modell}
              </td>
              <td className="px-3 py-2">{GETRIEBE_LABEL[vehicle.getriebe]}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {vehicle.baujahr ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <DeleteVehicleButton vehicleId={vehicle.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
