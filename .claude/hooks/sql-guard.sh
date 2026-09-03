#!/usr/bin/env bash
#
# PreToolUse-Hook (matcher: Bash)
#
# Erzwingt einen Permission-Prompt, sobald ein Shell-Kommando SQL gegen eine
# Datenbank ausfuehrt. Ergaenzung zu den permissions.ask-Regeln in
# .claude/settings.json: Permission-Regeln matchen nur den Anfang des
# Kommandos, dieser Hook durchsucht das gesamte Kommando. Damit wird auch
#   echo "DROP TABLE routen;" | psql "$DATABASE_URL"
# erfasst, das an "Bash(psql *)" vorbeilaeuft.
#
# Ausgabe bei Treffer: permissionDecision "ask" -> Claude Code fragt nach.
# Kein Treffer: keine Ausgabe, normale Permission-Pruefung greift.

set -uo pipefail

input=$(cat)

if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
else
  # Ohne jq lieber zu viel pruefen als zu wenig: gesamtes Payload durchsuchen.
  cmd=$input
fi

[ -z "$cmd" ] && exit 0

# SQL-Ausfuehrungsvektoren dieses Projekts (Postgres / Supabase CLI).
# Die Client-Binaries werden nur in Kommando-Position erkannt (Zeilenanfang
# oder nach | ; & ( ` $( ), optional hinter Wrappern wie sudo/npx. So loest
# das Wort "psql" in einer Commit-Message keinen Prompt aus.
wrappers='((sudo|env|time|npx|bunx|pnpm|yarn|dlx)[[:space:]]+([^[:space:]|;&(]+[[:space:]]+){0,4})*'
clients='(psql|pg_dump|pg_restore)'
pattern="(^|[|;&(\`]|\\$\\()[[:space:]]*${wrappers}${clients}([[:space:]]|$)"
# Supabase-CLI: dieselbe Kommando-Position-Logik, aber nur die SQL-relevanten
# Subkommandos (db, migration). "supabase functions list" bleibt unberuehrt.
pattern="${pattern}|(^|[|;&(\`]|\\$\\()[[:space:]]*${wrappers}supabase[[:space:]]+(db|migration)([[:space:]]|$)"

if printf '%s' "$cmd" | grep -Eqi "$pattern"; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"SQL-Ausfuehrung erkannt. Projektregel: SQL-Befehle immer vorher bestaetigen lassen."}}'
fi

exit 0
