import type { APIRoute } from 'astro'
import { roleFor } from '../../../lib/auth'
import {
  getCorrection,
  mettreAJour,
  miseAJourAgenceSchema,
  miseAJourAgentSchema,
  versContrat,
} from '../../../lib/corrections'
import { erreur, invalide, json, preflight, readJson } from '../../../lib/http'
import { getProjet } from '../../../lib/projets'
import { dashboardToken, getDb } from '../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Mise à jour d'une correction : l'agent n'écrit que les champs du § 5 du contrat,
// l'agence les champs de qualification. Corps : { revision, ...champs }.
export const PATCH: APIRoute = async ({ request, params }) => {
  const db = getDb()
  const correction = getCorrection(db, params.id ?? '')
  if (!correction) return json({ error: 'Correction introuvable' }, 404)

  const projet = getProjet(db, correction.projet)
  const role = roleFor(
    request.headers.get('authorization'),
    dashboardToken,
    projet?.jeton_agent ?? null
  )
  if (!role) return json({ error: 'Non autorisé' }, 401)

  const schema = role === 'agent' ? miseAJourAgentSchema : miseAJourAgenceSchema
  const parsed = schema.safeParse(await readJson(request))
  if (!parsed.success) return invalide(parsed.error.issues)

  try {
    return json(versContrat(mettreAJour(db, correction.id, role, parsed.data)))
  } catch (err) {
    return erreur(err)
  }
}
