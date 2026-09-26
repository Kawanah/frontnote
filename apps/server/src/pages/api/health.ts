import type { APIRoute } from 'astro'
import { getDb } from '../../lib/runtime'

// État du service : répond aussi quand la base ne s'ouvre pas, pour le diagnostic
export const GET: APIRoute = () => {
  let db = true
  try {
    getDb().prepare('SELECT 1').get()
  } catch (err) {
    console.error('[health] base inaccessible :', err)
    db = false
  }
  return Response.json({ ok: db, db, node: process.versions.node }, { status: db ? 200 : 503 })
}
