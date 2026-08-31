import { buildHeatmapDays } from "@/lib/heatmap";

const LEVEL_OPACITY = [1, 0.3, 0.55, 1];

function levelFor(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

export default function ActivityHeatmap({ dates }: { dates: string[] }) {
  const days = buildHeatmapDays(dates);

  return (
    // w-fit statt voller Breite: die Karte, in der der Graph steckt, ist oft
    // breiter als das Gitter selbst (52 Wochen ≈ 730px) — mit einer vollen
    // Flex-Column-Breite würde "self-end" die Legende an den rechten Rand
    // der ganzen Karte ziehen statt an den rechten Rand des Gitters direkt
    // darüber. w-fit lässt den Wrapper auf die (durch overflow-x-auto ggf.
    // gescrollte) Gitterbreite schrumpfen, sodass die Legende korrekt unter
    // dem sichtbaren Gitter sitzt statt lose weit rechts zu schweben.
    <div className="flex w-fit flex-col gap-2">
      <div className="overflow-x-auto">
        <div className="grid w-max grid-flow-col gap-1" style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}>
          {days.map(({ dateKey, count }) => {
            const level = levelFor(count);
            return (
              <div
                key={dateKey}
                title={`${new Date(dateKey).toLocaleDateString("de-CH", { timeZone: "UTC" })}: ${
                  count === 0 ? "keine Fahrt" : count === 1 ? "1 Fahrt" : `${count} Fahrten`
                }`}
                className="h-2.5 w-2.5 rounded-sm"
                style={{
                  backgroundColor: level === 0 ? "var(--color-border)" : "var(--color-accent)",
                  opacity: LEVEL_OPACITY[level],
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-1 self-end text-xs text-muted">
        <span>Weniger</span>
        {LEVEL_OPACITY.map((opacity, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-sm"
            style={{
              backgroundColor: i === 0 ? "var(--color-border)" : "var(--color-accent)",
              opacity,
            }}
          />
        ))}
        <span>Mehr</span>
      </div>
    </div>
  );
}
