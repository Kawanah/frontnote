import type { APIRoute } from 'astro'
import { dashboardToken, getDb } from '../../lib/runtime'

// État du service : répond aussi quand la base ne s'ouvre pas, pour le diagnostic
export const GET: APIRoute = () => {
  let db = true
  try {
    getDb().prepare('SELECT 1').get()
  } catch (err) {
    console.error('[health] base inaccessible :', err)
    db = false
  }
  // Diagnostic temporaire de la configuration : noms des variables reçues, jamais leurs valeurs
  const config = {
    jeton: Boolean(dashboardToken),
    jetonProcessEnv: Boolean(process.env.DASHBOARD_TOKEN),
    variables: Object.keys(process.env).filter((k) => /dash|token|node_env/i.test(k)),
  }
  return Response.json(
    { ok: db, db, node: process.versions.node, config },
    { status: db ? 200 : 503 }
  )
}
