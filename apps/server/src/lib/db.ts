import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type Db = Database.Database

// x / y : position du clic dans l'élément ciblé, en fraction de sa taille (0 à 1).
// Le pin reste au bon endroit quelle que soit la largeur d'écran.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  TEXT    NOT NULL,
    url         TEXT    NOT NULL,
    selector    TEXT    NOT NULL,
    x           REAL    NOT NULL,
    y           REAL    NOT NULL,
    type        TEXT    NOT NULL CHECK (type IN ('texte', 'couleur', 'photo', 'mise-en-page', 'autre')),
    message     TEXT    NOT NULL,
    color       TEXT,
    author      TEXT,
    status      TEXT    NOT NULL DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'resolu')),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS comments_project_status ON comments (project_id, status);
`

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}
