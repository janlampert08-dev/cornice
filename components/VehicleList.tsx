import type { Vehicle } from "@/types/database";
import DeleteVehicleButton from "@/components/DeleteVehicleButton";

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
    return <p className="text-sm text-[#8A8F98]">Noch keine Fahrzeuge hinterlegt.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-[#131316]/10 text-left text-[#8A8F98]">
          <th className="py-2 font-normal">Typ</th>
          <th className="py-2 font-normal">Marke / Modell</th>
          <th className="py-2 font-normal">Getriebe</th>
          <th className="py-2 text-right font-normal">Baujahr</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {vehicles.map((vehicle) => (
          <tr key={vehicle.id} className="border-b border-[#131316]/10">
            <td className="py-2">{TYP_LABEL[vehicle.typ]}</td>
            <td className="py-2">
              {vehicle.marke} {vehicle.modell}
            </td>
            <td className="py-2">{GETRIEBE_LABEL[vehicle.getriebe]}</td>
            <td className="py-2 text-right font-mono tabular-nums">
              {vehicle.baujahr ?? "—"}
            </td>
            <td className="py-2 text-right">
              <DeleteVehicleButton vehicleId={vehicle.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
