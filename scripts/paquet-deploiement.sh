#!/bin/sh
# Prépare deploy/frontnote/ : exactement ce qui part sur O2switch (apps/frontnote/).
# dist/ (autonome : dépendances incluses au build) + package.json minimal + tmp/restart.txt
# À lancer après « bun run build » (bun run paquet fait les deux).
set -e
racine="$(cd "$(dirname "$0")/.." && pwd)"
serveur="$racine/apps/server"
sortie="$racine/deploy/frontnote"

test -f "$serveur/dist/server/entry.mjs" || { echo "Build absent : lancer bun run build"; exit 1; }
test -f "$serveur/dist/client/frontnote.js" || { echo "frontnote.js absent du build"; exit 1; }

rm -rf "$sortie"
mkdir -p "$sortie/tmp"
cp -R "$serveur/dist" "$sortie/dist"
# Aucune dépendance : le build inclut tout (vite.ssr.noExternal), SQLite est celui de Node.
# « Run NPM Install » n'a donc rien à installer.
cat > "$sortie/package.json" <<'JSON'
{
  "name": "frontnote-server",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13.0" }
}
JSON
# O2switch (Passenger) redémarre l'appli quand ce fichier change
date -u +%Y-%m-%dT%H:%M:%SZ > "$sortie/tmp/restart.txt"

echo "Paquet prêt : deploy/frontnote/"
