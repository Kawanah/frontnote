import { DomainError } from './errors'

// Le widget tourne sur les domaines des sites clients : l'API accepte toutes les
// origines, sans cookies. Les routes de lecture/modification exigent le token.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

const MAX_BODY_CHARS = 20_000

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: CORS_HEADERS })

export const preflight = () => new Response(null, { status: 204, headers: CORS_HEADERS })

// Corps JSON, ou undefined si absent, trop gros ou mal formé
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text()
  if (!text || text.length > MAX_BODY_CHARS) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// IP du client derrière le proxy O2switch
export function clientIp(request: Request, fallback: string): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || fallback
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
