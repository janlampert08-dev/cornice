// Baut aus den GeoJSON-Linien (fetch-routes.mjs) und Höhenkennzahlen
// (enrich-routes.mjs) die finale Seed-SQL-Datei für Phase 3.
// Nutzung: node scripts/generate-seed-sql.mjs > supabase/seed/0001_routes.sql

import { readFile } from "node:fs/promises";

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

function pathLengthKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total / 1000;
}

// Redaktionelle Metadaten je Route — Geometrie/Länge/Höhe kommen aus den
// Overpass-/Elevation-Skripten, der Rest ist von Hand kuratiert.
const META = {
  albispass: {
    name: "Albispass",
    region: "Zürich",
    start_ort: "Adliswil",
    ziel_ort: "Hausen am Albis",
    kategorien: ["kurvig", "passstrasse"],
    saison_status: "ganzjaehrig",
    charakter_text:
      "Kurvige, dicht bewaldete Höhenstrasse über den Albiskamm südlich von Zürich.",
  },
  forch: {
    name: "Forch-Höhenstrasse",
    region: "Zürich",
    start_ort: "Zumikon",
    ziel_ort: "Esslingen",
    kategorien: ["scenic", "freie_fahrt"],
    saison_status: "ganzjaehrig",
    charakter_text:
      "Aussichtsreiche Höhenstrasse mit Blick über den Zürichsee, beliebte Feierabendrunde.",
  },
  uetliberg: {
    name: "Uetliberg",
    region: "Zürich",
    start_ort: "Zürich Triemli",
    ziel_ort: "Uetliberg (Uto Kulm)",
    kategorien: ["kurvig", "scenic"],
    saison_status: "ganzjaehrig",
    charakter_text:
      "Kurze, kurvige Auffahrt auf den Zürcher Hausberg mit Panoramablick über die Stadt.",
  },
  reusstal: {
    name: "Reusstal",
    region: "Aargau/Zürich",
    start_ort: "Sins",
    ziel_ort: "Bremgarten",
    kategorien: ["scenic", "freie_fahrt"],
    saison_status: "ganzjaehrig",
    charakter_text:
      "Flache, kurvenreiche Strecke entlang der Reuss durchs Freiamt ohne grössere Steigungen.",
  },
  "zimmerberg-rundfahrt": {
    name: "Zimmerberg-Rundfahrt",
    region: "Zürich",
    start_ort: "Zürich",
    ziel_ort: "Zürich",
    kategorien: ["kurvig", "scenic", "passstrasse"],
    saison_status: "ganzjaehrig",
    charakter_text:
      "Rundfahrt ab Zürich: flach durchs Sihltal nach Süden, kurvige Rückfahrt über den Albispass.",
  },
};

function sqlString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

function toWkt(coords) {
  return `LINESTRING(${coords.map(([lon, lat]) => `${lon} ${lat}`).join(",")})`;
}

async function buildInsert(key) {
  const meta = META[key];
  if (!meta) throw new Error(`Keine Metadaten für ${key}`);

  const geojson = JSON.parse(await readFile(`scripts/output/${key}.geojson`, "utf8"));
  const coords = geojson.geometry.coordinates;
  const stats = JSON.parse(await readFile(`scripts/output/${key}.stats.json`, "utf8"));
  const tempolimits = JSON.parse(
    await readFile(`scripts/output/${key}.tempolimits.json`, "utf8"),
  );

  const laengeKm = Number(pathLengthKm(coords).toFixed(1));
  const maxSteigung = meta.max_steigung_prozent ?? stats.maxSteigung;
  const start = coords[0];
  const end = coords[coords.length - 1];
  const kategorienArr = `ARRAY[${meta.kategorien.map(sqlString).join(",")}]::text[]`;
  const tempolimitsJson = JSON.stringify(tempolimits).replace(/'/g, "''");

  return `insert into public.routes (
  name, region, start_ort, ziel_ort,
  start_coord, ziel_coord, geometry,
  hoehe_m, laenge_km, max_steigung_prozent,
  kategorien, saison_status, status_ok, charakter_text, tempolimits, erstellt_von
) values (
  ${sqlString(meta.name)}, ${sqlString(meta.region)}, ${sqlString(meta.start_ort)}, ${sqlString(meta.ziel_ort)},
  ST_GeogFromText('SRID=4326;POINT(${start[0]} ${start[1]})'),
  ST_GeogFromText('SRID=4326;POINT(${end[0]} ${end[1]})'),
  ST_GeogFromText('SRID=4326;${toWkt(coords)}'),
  ${stats.hoeheM}, ${laengeKm}, ${maxSteigung},
  ${kategorienArr}, ${sqlString(meta.saison_status)}, true, ${sqlString(meta.charakter_text)},
  '${tempolimitsJson}'::jsonb, null
);`;
}

async function main() {
  const filterKey = process.argv[2];
  const keys = filterKey ? [filterKey] : Object.keys(META);
  const statements = [];
  for (const key of keys) statements.push(await buildInsert(key));

  console.log(`-- Seed-Daten: ${keys.join(", ")}.`);
  console.log("-- Geometrie via Overpass-API (OSM) + Dijkstra-Routing, Höhe via Open-Elevation.");
  console.log("-- Generiert von scripts/generate-seed-sql.mjs — nicht von Hand bearbeiten,");
  console.log("-- stattdessen META in diesem Skript anpassen und neu generieren.\n");
  console.log(statements.join("\n\n"));
}

main();
