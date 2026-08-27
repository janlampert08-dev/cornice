// Reichert die von fetch-routes.mjs/fetch-loop-route.mjs erzeugten GeoJSON-
// Linien mit Höhenprofil-Kennzahlen an: hoehe_m (Scheitelpunkt),
// max_steigung_prozent und kehren (Serpentinenzahl).
//
// Höhendaten kommen vom swisstopo-Höhenprofilservice (swissALTI3D, ~2m
// Genauigkeit) statt einem globalen Gratis-DEM wie SRTM — kalibriert gegen
// bekannte Passwerte (Julierpass 12% laut Nutzerangabe, Sustenpass 9% und
// Flüelapass 7-9% laut quaeldich.de/paesse.info): 90. Perzentil der
// Steigung über ein 150m-Fenster trifft alle drei auf 1-3 Prozentpunkte
// genau, das reine Maximum lag durchgehend 2-3x zu hoch (Tunnel-/Brücken-
// Segmente, wo die Geländeoberfläche nicht der Strasse entspricht).
// Kehrenzahl kalibriert gegen quaeldich.de: Julierpass exakt 26/26 getroffen.
//
// Nutzung: node scripts/enrich-routes.mjs [routeKey]
// Ergebnis: scripts/output/<key>.stats.json

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

function haversine([lon1, lat1], [lon2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing([lon1, lat1], [lon2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function wgs84ToLv95([lon, lat]) {
  const latSec = (lat * 3600 - 169028.66) / 10000;
  const lonSec = (lon * 3600 - 26782.5) / 10000;
  const E =
    2600072.37 +
    211455.93 * lonSec -
    10938.51 * lonSec * latSec -
    0.36 * lonSec * latSec * latSec -
    44.54 * lonSec ** 3;
  const N =
    1200147.07 +
    308807.95 * latSec +
    3745.25 * lonSec ** 2 +
    76.63 * latSec ** 2 -
    194.56 * lonSec ** 2 * latSec +
    119.79 * latSec ** 3;
  return [E, N];
}

async function fetchElevationProfile(coords) {
  const lv95 = coords.map(wgs84ToLv95);
  const geom = JSON.stringify({ type: "LineString", coordinates: lv95 });
  const body = new URLSearchParams({ geom, sr: "2056", nb_points: "300" });

  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 4000 * attempt));
    try {
      const res = await fetch("https://api3.geo.admin.ch/rest/services/profile.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        lastError = new Error(`swisstopo profile HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error("Unerwartetes Antwortformat");
      return json.map((p) => ({ dist: p.dist, elevation: p.alts.COMB }));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function medianSmooth(values) {
  if (values.length < 3) return values.slice();
  const out = [values[0]];
  for (let i = 1; i < values.length - 1; i++) {
    out.push([values[i - 1], values[i], values[i + 1]].sort((a, b) => a - b)[1]);
  }
  out.push(values[values.length - 1]);
  return out;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function computeHoeheUndSteigung(profile) {
  const elevations = profile.map((p) => p.elevation);
  const dists = profile.map((p) => p.dist);
  const smoothed = medianSmooth(elevations);
  const hoeheM = Math.round(Math.max(...smoothed));

  const windowM = 150;
  const grads = [];
  let start = 0;
  for (let end = 1; end < dists.length; end++) {
    while (dists[end] - dists[start] > windowM && start < end - 1) start++;
    const dist = dists[end] - dists[start];
    if (dist < windowM * 0.5) continue;
    const dElev = Math.abs(smoothed[end] - smoothed[start]);
    grads.push((dElev / dist) * 100);
  }

  const maxSteigungProzent = grads.length ? Number(percentile(grads, 90).toFixed(1)) : 0;
  return { hoeheM, maxSteigungProzent };
}

function buildHoehenprofil(profile, targetPoints = 80) {
  const smoothed = medianSmooth(profile.map((p) => p.elevation));
  const step = Math.max(1, Math.floor(profile.length / targetPoints));
  const points = [];
  for (let i = 0; i < profile.length; i += step) {
    points.push({ km: Number((profile[i].dist / 1000).toFixed(2)), m: Math.round(smoothed[i]) });
  }
  const last = profile.length - 1;
  const lastKm = Number((profile[last].dist / 1000).toFixed(2));
  if (points[points.length - 1]?.km !== lastKm) {
    points.push({ km: lastKm, m: Math.round(smoothed[last]) });
  }
  return points;
}

function resampleByDistance(coords, stepM) {
  const out = [coords[0]];
  let carry = 0;
  for (let i = 1; i < coords.length; i++) {
    const segStart = coords[i - 1];
    const segEnd = coords[i];
    const segLen = haversine(segStart, segEnd);
    let segCovered = 0;
    while (carry + (segLen - segCovered) >= stepM) {
      const need = stepM - carry;
      const t = (segCovered + need) / segLen;
      out.push([segStart[0] + (segEnd[0] - segStart[0]) * t, segStart[1] + (segEnd[1] - segStart[1]) * t]);
      segCovered += need;
      carry = 0;
    }
    carry += segLen - segCovered;
  }
  return out;
}

function countKehren(coords, { step = 15, windowM = 80, threshold = 80, minGapM = 60 } = {}) {
  const even = resampleByDistance(coords, step);
  const n = Math.round(windowM / step);
  if (even.length < 2 * n + 1) return 0;

  const turns = [];
  for (let i = n; i < even.length - n; i++) {
    const bBehind = bearing(even[i - n], even[i]);
    const bAhead = bearing(even[i], even[i + n]);
    turns.push({ distM: i * step, turn: angleDiff(bAhead, bBehind) });
  }

  const candidates = turns.filter(
    (t, i) => t.turn > threshold && t.turn >= (turns[i - 1]?.turn ?? 0) && t.turn >= (turns[i + 1]?.turn ?? 0),
  );

  const merged = [];
  for (const c of candidates) {
    const last = merged[merged.length - 1];
    if (last && c.distM - last.distM < minGapM) {
      if (c.turn > last.turn) merged[merged.length - 1] = c;
    } else {
      merged.push(c);
    }
  }
  return merged.length;
}

async function processFile(key) {
  const file = path.join("scripts/output", `${key}.geojson`);
  const geojson = JSON.parse(await readFile(file, "utf8"));
  const coords = geojson.geometry.coordinates;

  const profile = await fetchElevationProfile(coords);
  const { hoeheM, maxSteigungProzent } = computeHoeheUndSteigung(profile);
  const kehren = countKehren(coords);
  const hoehenprofil = buildHoehenprofil(profile);

  const stats = {
    key,
    hoeheM,
    maxSteigung: maxSteigungProzent,
    kehren,
    hoehenprofil,
    points: coords.length,
  };
  await writeFile(
    path.join("scripts/output", `${key}.stats.json`),
    JSON.stringify(stats, null, 2),
  );
  return stats;
}

async function main() {
  const filterKey = process.argv[2];
  const files = await readdir("scripts/output");
  const keys = files
    .filter((f) => f.endsWith(".geojson"))
    .map((f) => f.replace(".geojson", ""))
    .filter((k) => !filterKey || k === filterKey);

  const results = [];
  for (const key of keys) {
    console.error(`Enriching ${key}...`);
    try {
      results.push(await processFile(key));
    } catch (err) {
      results.push({ key, error: String(err) });
    }
  }
  console.table(results);
}

main();
