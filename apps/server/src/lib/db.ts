import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// SQLite intégré à Node (≥ 22.13) : aucun module compilé à installer sur le serveur
export type Db = DatabaseSync

// Migrations appliquées dans l'ordre, suivies par PRAGMA user_version.
// Ne jamais modifier une migration déployée : en ajouter une nouvelle.
// Les listes (statuts, natures…) sont validées par Zod, pas par des CHECK :
// les faire évoluer ne demande pas de reconstruire les tables.
// Noms de colonnes = noms de champs du contrat de corrections.
export const MIGRATIONS = [
  `CREATE TABLE projets (
     id            TEXT    PRIMARY KEY,
     nom           TEXT    NOT NULL,
     prefixe       TEXT    NOT NULL DEFAULT 'REC-',
     compteur      INTEGER NOT NULL DEFAULT 0,  -- dernier numéro attribué, ne recule jamais
     natures       TEXT    NOT NULL,            -- JSON : natures actives
     jeton_agent   TEXT,                        -- empreinte SHA-256 du jeton de l'agent
     revision      INTEGER NOT NULL DEFAULT 0,  -- augmente à chaque écriture
     mis_a_jour_le TEXT    NOT NULL,
     cree_le       TEXT    NOT NULL
   );

   CREATE TABLE corrections (
     id               TEXT PRIMARY KEY,         -- REC-012 : jamais réutilisé
     projet           TEXT NOT NULL REFERENCES projets (id),
     date_signalement TEXT NOT NULL,
     signale_par      TEXT NOT NULL,
     canal            TEXT NOT NULL,
     page             TEXT NOT NULL,
     etat             TEXT,
     zone             TEXT NOT NULL,
     appareil         TEXT NOT NULL,
     navigateur       TEXT,
     nature           TEXT,
     constat          TEXT,
     attendu          TEXT,
     texte_actuel     TEXT,
     texte_attendu    TEXT,                     -- mot pour mot, jamais retouché
     source_texte     TEXT,                     -- JSON { lien, lu_le }
     pieces_jointes   TEXT NOT NULL DEFAULT '[]', -- JSON : liens
     gravite          TEXT,
     test_lie         TEXT,
     ligne_suivi      INTEGER,
     lieu_correction  TEXT,
     lot              TEXT,
     statut           TEXT NOT NULL DEFAULT 'nouvelle',
     question         TEXT,
     signalement      TEXT,
     note             TEXT,
     traitement       TEXT,                     -- JSON, champs de l'agent
     -- Hors contrat : ancrage du pin et détails du widget
     type_client      TEXT,
     url              TEXT,
     selecteur        TEXT,
     x                REAL,
     y                REAL,
     couleur          TEXT,
     auteur           TEXT,
     contexte         TEXT,                     -- JSON : contexte technique brut
     cree_le          TEXT NOT NULL,
     mis_a_jour_le    TEXT NOT NULL
   );
   CREATE INDEX corrections_projet_statut ON corrections (projet, statut);

   -- Historique : on ajoute, on ne réécrit jamais
   CREATE TABLE historique (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     correction_id TEXT NOT NULL REFERENCES corrections (id),
     date          TEXT NOT NULL,
     auteur        TEXT NOT NULL,
     de            TEXT,
     vers          TEXT NOT NULL,
     note          TEXT NOT NULL DEFAULT ''
   );
   CREATE INDEX historique_correction ON historique (correction_id);`,

  // 2 — Un préfixe par projet : corrections.id est unique pour toute la base, deux
  // projets en REC- fabriquaient le même REC-012 (incident du 2026-09-27).
  // En production, kawanah (REC-001 seulement) passe en KAW- ; coress garde REC-.
  // Contraintes vérifiées au COMMIT : l'historique suit le renommage.
  `PRAGMA defer_foreign_keys = ON;

   CREATE TEMP TABLE renommer AS
     SELECT 1 FROM projets k
     WHERE k.id = 'kawanah' AND k.prefixe = 'REC-'
       AND EXISTS (SELECT 1 FROM projets p WHERE p.id <> 'kawanah' AND p.prefixe = 'REC-');

   UPDATE historique SET correction_id = 'KAW-' || substr(correction_id, 5)
   WHERE EXISTS (SELECT 1 FROM renommer)
     AND correction_id IN (SELECT id FROM corrections WHERE projet = 'kawanah' AND id LIKE 'REC-%');

   UPDATE corrections SET id = 'KAW-' || substr(id, 5)
   WHERE EXISTS (SELECT 1 FROM renommer) AND projet = 'kawanah' AND id LIKE 'REC-%';

   UPDATE projets
   SET prefixe = 'KAW-', revision = revision + 1,
       mis_a_jour_le = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
   WHERE EXISTS (SELECT 1 FROM renommer) AND id = 'kawanah';

   DROP TABLE renommer;

   CREATE UNIQUE INDEX projets_prefixe ON projets (prefixe);`,
]

// Exécute fn dans une transaction : tout ou rien
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export const userVersion = (db: Db) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version

function migrate(db: Db) {
  const current = userVersion(db)
  MIGRATIONS.slice(current).forEach((sql, i) => {
    transaction(db, () => {
      db.exec(sql)
      db.exec(`PRAGMA user_version = ${current + i + 1}`)
    })
  })
}

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  migrate(db)
  return db
}
