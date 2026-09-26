#!/bin/sh
# Fabrique deploy/frontnote.zip : ce qu'il faut déposer sur O2switch
# (dist/ + package.json + package-lock.json). À lancer après « bun run build ».
set -e
racine="$(cd "$(dirname "$0")/.." && pwd)"
serveur="$racine/apps/server"
sortie="$racine/deploy"
travail="$(mktemp -d)"

test -f "$serveur/dist/server/entry.mjs" || { echo "Build absent : lancer bun run build"; exit 1; }
test -f "$serveur/dist/client/frontnote.js" || { echo "frontnote.js absent du build"; exit 1; }

cp -R "$serveur/dist" "$travail/dist"
cp "$serveur/package.json" "$travail/package.json"
# Verrouille les versions installées par npm sur O2switch
(cd "$travail" && npm install --package-lock-only --omit=dev --ignore-scripts --silent)

mkdir -p "$sortie"
rm -f "$sortie/frontnote.zip"
(cd "$travail" && zip -qr "$sortie/frontnote.zip" dist package.json package-lock.json)
rm -rf "$travail"
echo "Paquet prêt : deploy/frontnote.zip ($(du -h "$sortie/frontnote.zip" | cut -f1))"
