import { DomainError } from './errors'

// Le widget tourne sur les domaines des sites clients : l'API accepte toutes les
// origines, sans cookies. Les routes de lecture/modification exigent le token.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export const MAX_BODY_CHARS = 20_000

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS })

// Limite de débit atteinte (429)
export const tropDeRequetes = () => json({ error: 'Trop de requêtes, réessayez plus tard' }, 429)

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS })

// Corps JSON, ou undefined si absent, trop gros ou mal formé
export async function readJson(request: Request, max = MAX_BODY_CHARS): Promise<unknown> {
  const text = await request.text()
  if (!text || text.length > max) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// IP du client derrière le proxy O2switch : la dernière adresse de X-Forwarded-For,
// celle que le proxy a ajoutée. Les précédentes viennent du client, qui peut en
// inventer une à chaque requête pour échapper aux limites de débit.
export function clientIp(request: Request, fallback: string): string {
  return request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || fallback
}

// Réponse d'erreur métier, ou 500 sans détail
export function erreur(err: unknown): Response {
  if (err instanceof DomainError) return json({ error: err.message }, err.status)
  console.error(err)
  return json({ error: 'Erreur interne' }, 500)
}

// Erreurs de validation Zod, lisibles par l'agent
export const invalide = (issues: { path: PropertyKey[]; message: string }[]) =>
  json(
    {
      error: 'Données invalides',
      issues: issues.map((i) => ({ champ: i.path.map(String).join('.'), message: i.message })),
    },
    400
  )
