// Aktualisiert hoehe_m/max_steigung_prozent/kehren für die bereits gesäten
// Strecken mit den swisstopo-basierten Werten aus enrich-routes.mjs.
// Nutzung: node scripts/generate-stats-update-sql.mjs > supabase/seed/0007_stats_update.sql

import { readFile } from "node:fs/promises";

const NAME_BY_KEY = {
  julierpass: "Julierpass",
  klausenpass: "Klausenpass",
  sustenpass: "Sustenpass",
  fluelapass: "Flüelapass",
  albispass: "Albispass",
  forch: "Forch-Höhenstrasse",
  uetliberg: "Uetliberg",
  reusstal: "Reusstal",
  "zimmerberg-rundfahrt": "Zimmerberg-Rundfahrt",
};

// Julierpass: Nutzerangabe (12%) geht der automatischen Schätzung vor.
const STEIGUNG_OVERRIDE = { julierpass: 12 };

function sqlString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

async function buildUpdate(key) {
  const name = NAME_BY_KEY[key];
  const stats = JSON.parse(await readFile(`scripts/output/${key}.stats.json`, "utf8"));
  const maxSteigung = STEIGUNG_OVERRIDE[key] ?? stats.maxSteigung;
  return `update public.routes set hoehe_m = ${stats.hoeheM}, max_steigung_prozent = ${maxSteigung}, kehren = ${stats.kehren} where name = ${sqlString(name)};`;
}

async function main() {
  const statements = [];
  for (const key of Object.keys(NAME_BY_KEY)) statements.push(await buildUpdate(key));

  console.log("-- Höhe/Steigung/Kehren neu berechnet via swisstopo-Höhenprofil (swissALTI3D).");
  console.log("-- Generiert von scripts/generate-stats-update-sql.mjs.\n");
  console.log(statements.join("\n"));
}

main();
