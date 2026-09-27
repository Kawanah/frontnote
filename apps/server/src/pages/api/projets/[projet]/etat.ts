import type { APIRoute } from 'astro'
import { cleValide } from '../../../../lib/auth'
import { json, preflight } from '../../../../lib/http'
import { getProjet } from '../../../../lib/projets'
import { getDb } from '../../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Public (widget) : GET /api/projets/:projet/etat?cle=<clé du lien>
// { ouvert, active } : active = projet ouvert et clé valide → le widget s'affiche.
// Projet inconnu → 404. Rien d'autre n'est exposé.
export const GET: APIRoute = ({ params, url }) => {
  const projet = getProjet(getDb(), params.projet ?? '')
  if (!projet) return json({ ouvert: false, active: false }, 404)
  const ouvert = !projet.clos_le
  const cle = url.searchParams.get('cle') ?? undefined
  return json({ ouvert, active: ouvert && cleValide(projet.cle_activation, cle) })
}
