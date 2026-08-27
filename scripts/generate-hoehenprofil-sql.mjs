// Trägt das Höhenprofil-Diagramm-Datenarray für die bereits gesäten
// Strecken nach. Nutzung:
// node scripts/generate-hoehenprofil-sql.mjs > supabase/seed/0012_hoehenprofil.sql

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
  const stats = JSON.parse(await readFile(`scripts/output/${key}.stats.json`, "utf8"));
  const json = JSON.stringify(stats.hoehenprofil).replace(/'/g, "''");
  return `update public.routes set hoehenprofil = '${json}'::jsonb where name = ${sqlString(name)};`;
}

async function main() {
  const statements = [];
  for (const key of Object.keys(NAME_BY_KEY)) statements.push(await buildUpdate(key));

  console.log("-- Höhenprofil-Diagrammdaten für die Seed-Strecken (swisstopo swissALTI3D).");
  console.log("-- Generiert von scripts/generate-hoehenprofil-sql.mjs.\n");
  console.log(statements.join("\n"));
}

main();
