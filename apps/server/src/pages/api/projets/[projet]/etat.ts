import type { APIRoute } from 'astro'
import { json, preflight } from '../../../../lib/http'
import { getProjet } from '../../../../lib/projets'
import { getDb } from '../../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Public (widget) : le projet accepte-t-il des retours ? Rien d'autre n'est exposé.
// Projet clos ou inconnu → le widget ne s'affiche pas.
export const GET: APIRoute = ({ params }) => {
  const projet = getProjet(getDb(), params.projet ?? '')
  if (!projet) return json({ ouvert: false }, 404)
  return json({ ouvert: !projet.clos_le })
}
