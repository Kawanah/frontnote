import type { APIRoute } from 'astro'
import { isAuthorized } from '../../../lib/auth'
import { setCommentStatus, statusUpdateSchema } from '../../../lib/comments'
import { json, preflight, readJson } from '../../../lib/http'
import { dashboardToken, getDb } from '../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Changement de statut ouvert / résolu (dashboard, token requis)
export const PATCH: APIRoute = async ({ request, params }) => {
  if (!isAuthorized(request.headers.get('authorization'), dashboardToken)) {
    return json({ error: 'Non autorisé' }, 401)
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id < 1) return json({ error: 'Identifiant invalide' }, 400)

  const parsed = statusUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return json({ error: 'Statut attendu : ouvert ou resolu' }, 400)

  const comment = setCommentStatus(getDb(), id, parsed.data.status)
  return comment ? json(comment) : json({ error: 'Commentaire introuvable' }, 404)
}
