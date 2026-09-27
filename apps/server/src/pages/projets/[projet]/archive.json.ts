import type { APIRoute } from 'astro'
import { archiverProjet } from '../../../lib/corrections'
import { aujourdhui } from '../../../lib/dates'
import { getProjet } from '../../../lib/projets'
import { getDb } from '../../../lib/runtime'

// Archive complète d'un projet, à télécharger avant de le clore (session du dashboard)
export const GET: APIRoute = ({ params }) => {
  const db = getDb()
  const projet = getProjet(db, params.projet ?? '')
  if (!projet) return new Response('Projet inconnu', { status: 404 })

  return new Response(JSON.stringify(archiverProjet(db, projet.id), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="frontnote-${projet.id}-${aujourdhui()}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
