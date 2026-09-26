import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type Db = Database.Database

// Migrations appliquées dans l'ordre, suivies par PRAGMA user_version.
// Ne jamais modifier une migration publiée : en ajouter une nouvelle.
// Les listes (types, priorités, statuts) sont validées par Zod, pas par des
// CHECK : les faire évoluer ne demande pas de reconstruire la table.
const MIGRATIONS = [
  // 1 : table des commentaires
  // x / y : position du clic dans l'élément, en fraction de sa taille (0 à 1)
  // context : JSON du contexte technique (navigateur, écran…)
  `CREATE TABLE comments (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id  TEXT    NOT NULL,
     url         TEXT    NOT NULL,
     selector    TEXT    NOT NULL,
     x           REAL    NOT NULL,
     y           REAL    NOT NULL,
     type        TEXT    NOT NULL,
     priority    TEXT    NOT NULL,
     message     TEXT    NOT NULL,
     color       TEXT,
     author      TEXT,
     context     TEXT,
     status      TEXT    NOT NULL DEFAULT 'ouvert',
     created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     resolved_at TEXT
   );
   CREATE INDEX comments_project_status ON comments (project_id, status);`,
]

function migrate(db: Db) {
  const current = db.pragma('user_version', { simple: true }) as number
  MIGRATIONS.slice(current).forEach((sql, i) => {
    db.transaction(() => {
      db.exec(sql)
      db.pragma(`user_version = ${current + i + 1}`)
    })()
  })
}

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}
