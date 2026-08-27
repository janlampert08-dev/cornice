// Ergänzt die bereits gesäten Strecken (Phase 3) um Tempolimit-Daten,
// ohne sie neu einzufügen. Nutzung:
// node scripts/generate-tempolimits-sql.mjs > supabase/seed/0005_tempolimits.sql

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

function sqlString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

async function buildUpdate(key) {
  const name = NAME_BY_KEY[key];
  const segments = JSON.parse(
    await readFile(`scripts/output/${key}.tempolimits.json`, "utf8"),
  );
  const json = JSON.stringify(segments).replace(/'/g, "''");
  return `update public.routes set tempolimits = '${json}'::jsonb where name = ${sqlString(name)};`;
}

async function main() {
  const statements = [];
  for (const key of Object.keys(NAME_BY_KEY)) statements.push(await buildUpdate(key));

  console.log("-- Tempolimit-Daten für die Phase-3-Seed-Strecken (aus OSM maxspeed).");
  console.log("-- Generiert von scripts/generate-tempolimits-sql.mjs.\n");
  console.log(statements.join("\n"));
}

main();
