#!/bin/sh
# Prépare deploy/frontnote/ : exactement ce qui part sur O2switch (apps/frontnote/).
# dist/ + package.json + package-lock.json + tmp/restart.txt
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
cp "$serveur/package.json" "$sortie/package.json"
# Verrouille les versions que « Run NPM Install » installera sur O2switch
(cd "$sortie" && npm install --package-lock-only --omit=dev --ignore-scripts --silent)
# O2switch (Passenger) redémarre l'appli quand ce fichier change
date -u +%Y-%m-%dT%H:%M:%SZ > "$sortie/tmp/restart.txt"

echo "Paquet prêt : deploy/frontnote/"
