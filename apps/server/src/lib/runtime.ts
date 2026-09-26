import { DASHBOARD_TOKEN, DATABASE_PATH } from 'astro:env/server'
import { openDatabase, type Db } from './db'

let db: Db | undefined

// Connexion unique, ouverte au premier appel
export function getDb(): Db {
  db ??= openDatabase(DATABASE_PATH)
  return db
}

export const dashboardToken = DASHBOARD_TOKEN
