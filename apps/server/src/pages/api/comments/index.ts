import type { APIRoute } from 'astro'
import { isAuthorized } from '../../../lib/auth'
import {
  commentFilterSchema,
  commentInputSchema,
  createComment,
  listComments,
} from '../../../lib/comments'
import { clientIp, json, preflight, readJson } from '../../../lib/http'
import { createRateLimiter } from '../../../lib/rateLimit'
import { dashboardToken, getDb } from '../../../lib/runtime'

// 30 commentaires par IP toutes les 10 minutes
const allowPost = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 })

export const OPTIONS: APIRoute = () => preflight()

// Envoi d'un commentaire par le widget (public)
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!allowPost(clientIp(request, clientAddress))) {
    return json({ error: 'Trop de requêtes, réessayez plus tard' }, 429)
  }

  const parsed = commentInputSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    return json({ error: 'Données invalides', issues }, 400)
  }

  const { _honey, ...input } = parsed.data
  // Robot détecté : faux succès, rien n'est enregistré
  if (_honey) return json({ ok: true }, 201)

  return json(createComment(getDb(), input), 201)
}

// Liste des commentaires (dashboard, token requis)
export const GET: APIRoute = ({ request, url }) => {
  if (!isAuthorized(request.headers.get('authorization'), dashboardToken)) {
    return json({ error: 'Non autorisé' }, 401)
  }

  const parsed = commentFilterSchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return json({ error: 'Filtre invalide' }, 400)

  return json(listComments(getDb(), parsed.data))
}
