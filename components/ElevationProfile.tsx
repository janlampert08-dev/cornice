import type { HoehenprofilPunkt } from "@/types/database";

const WIDTH = 600;
const HEIGHT = 120;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 4;

export default function ElevationProfile({ punkte }: { punkte: HoehenprofilPunkt[] }) {
  if (punkte.length < 2) return null;

  const kmMax = punkte[punkte.length - 1].km || 1;
  const mMin = Math.min(...punkte.map((p) => p.m));
  const mMax = Math.max(...punkte.map((p) => p.m));
  const mRange = Math.max(mMax - mMin, 1);

  const x = (km: number) => (km / kmMax) * WIDTH;
  const y = (m: number) =>
    PADDING_TOP + (1 - (m - mMin) / mRange) * (HEIGHT - PADDING_TOP - PADDING_BOTTOM);

  const linePath = punkte.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.km).toFixed(1)} ${y(p.m).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`;

  const gipfel = punkte.reduce((a, b) => (b.m > a.m ? b : a));

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label={`Höhenprofil, Scheitelpunkt ${gipfel.m} m bei km ${gipfel.km}`}
      >
        <defs>
          <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D5AFE" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3D5AFE" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#elevation-fill)" />
        <path d={linePath} fill="none" stroke="#3D5AFE" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(gipfel.km)} cy={y(gipfel.m)} r="3" fill="#3D5AFE" />
      </svg>
      <div className="flex justify-between font-mono text-xs tabular-nums text-[#8A8F98]">
        <span>{mMin} m</span>
        <span>{gipfel.m} m bei km {gipfel.km.toFixed(0)}</span>
        <span>{mMax} m</span>
      </div>
    </div>
  );
}
