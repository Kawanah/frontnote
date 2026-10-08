// Sauvegarde complète de la base. La base est en WAL : copier le fichier .db
// pendant que l'app tourne peut perdre les écritures encore dans le -wal.
// VACUUM INTO produit une copie cohérente, WAL compris, sans module externe.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from './db'

// Copie de la base, en octets. Le fichier passe par un dossier temporaire
// (jamais data/) supprimé dans tous les cas. dossier : modifiable pour les tests.
export function sauvegarder(db: Db, dossier = tmpdir()): Uint8Array<ArrayBuffer> {
  const temporaire = mkdtempSync(join(dossier, 'frontnote-sauvegarde-'))
  try {
    // Chemin construit ici seulement, rien ne vient de la requête ; VACUUM INTO
    // n'accepte pas de paramètre lié, on refuse donc toute apostrophe
    const chemin = join(temporaire, 'frontnote.db')
    if (chemin.includes("'")) throw new Error('Chemin temporaire inutilisable pour la sauvegarde')
    db.exec(`VACUUM INTO '${chemin}'`)
    return new Uint8Array(readFileSync(chemin))
  } finally {
    rmSync(temporaire, { recursive: true, force: true })
  }
}
