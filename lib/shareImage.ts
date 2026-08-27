import { formatDuration } from "@/lib/format";

export interface ShareRideData {
  routeName: string;
  region: string;
  distanceKm: number;
  durationSeconds: number | null;
  date: string;
  elevationM: number | null;
  coordinates: [number, number][];
}

const WIDTH = 1080;
const HEIGHT = 1350;
const INK = "#131316";
const MUTED = "#8A8F98";
const ACCENT = "#3D5AFE";
const BG = "#FAFAFA";

// Projiziert [lng,lat]-Koordinaten auf Canvas-Pixel: einfache äquirektangulare
// Näherung mit Breitengrad-Korrektur (cos(avgLat)) reicht für den kleinen
// geografischen Ausschnitt einer einzelnen Schweizer Passstrasse völlig aus.
function projectRoute(
  coordinates: [number, number][],
  box: { x: number; y: number; w: number; h: number },
): [number, number][] {
  const lats = coordinates.map((c) => c[1]);
  const avgLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);

  const xs = coordinates.map((c) => c[0] * cosLat);
  const ys = coordinates.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;

  const scale = Math.min(box.w / spanX, box.h / spanY);
  const centerX = box.x + box.w / 2;
  const centerY = box.y + box.h / 2;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  return xs.map((x, i) => [
    centerX + (x - midX) * scale,
    centerY - (ys[i] - midY) * scale,
  ]);
}

export function renderShareImage(data: ShareRideData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas wird nicht unterstützt."));

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = MUTED;
  ctx.font = "600 28px system-ui, sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("CORNICE", 72, 96);

  ctx.fillStyle = INK;
  ctx.font = "700 56px system-ui, sans-serif";
  wrapText(ctx, data.routeName, 72, 176, WIDTH - 144, 62);

  ctx.fillStyle = MUTED;
  ctx.font = "400 30px system-ui, sans-serif";
  const dateLabel = new Date(data.date).toLocaleDateString("de-CH");
  ctx.fillText(`${data.region} · ${dateLabel}`, 72, 250);

  if (data.coordinates.length > 1) {
    const points = projectRoute(data.coordinates, { x: 100, y: 330, w: WIDTH - 200, h: 620 });
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();

    for (const [x, y] of [points[0], points[points.length - 1]]) {
      ctx.beginPath();
      ctx.fillStyle = ACCENT;
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.strokeStyle = BG;
      ctx.lineWidth = 4;
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const avgKmh =
    data.durationSeconds && data.durationSeconds > 0
      ? data.distanceKm / (data.durationSeconds / 3600)
      : null;

  const facts: [string, string][] = [
    ["Distanz", `${data.distanceKm.toFixed(1)} km`],
    ["Zeit", data.durationSeconds !== null ? formatDuration(data.durationSeconds) : "—"],
    ["Ø Tempo", avgKmh !== null ? `${avgKmh.toFixed(0)} km/h` : "—"],
    ["Höhe", data.elevationM !== null ? `${data.elevationM} m` : "—"],
  ];

  const factBoxY = 1030;
  const colW = (WIDTH - 144) / facts.length;
  facts.forEach(([label, value], i) => {
    const x = 72 + i * colW;
    ctx.fillStyle = MUTED;
    ctx.font = "400 24px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), x, factBoxY);
    ctx.fillStyle = INK;
    ctx.font = "700 44px ui-monospace, monospace";
    ctx.fillText(value, x, factBoxY + 56);
  });

  ctx.strokeStyle = `${INK}1A`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, 980);
  ctx.lineTo(WIDTH - 72, 980);
  ctx.stroke();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Bild konnte nicht erstellt werden."))),
      "image/jpeg",
      0.92,
    );
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
      lines++;
      if (lines >= 2) break;
    } else {
      line = test;
    }
  }
  if (lines < 2) ctx.fillText(line, x, lineY);
}
