import type { APIRoute } from 'astro'
import {
  accesCarnetSchema,
  carnetIdSchema,
  ecritureCarnetSchema,
  enregistrerCarnet,
  lireCarnet,
} from '../../../lib/carnets'
import { clientIp, erreur, invalide, json, preflight, readJson } from '../../../lib/http'
import { limiteCarnets } from '../../../lib/limites'
import { getDb } from '../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Brouillons et envoyés d'un carnet : 1 000 retours complets au plus
const MAX_CARNET_CHARS = 2_000_000

const trop = () => json({ error: 'Trop de requêtes, réessayez plus tard' }, 429)

// Public (widget) : GET /api/carnets/:id?projet=&cle= → { carnet }
export const GET: APIRoute = ({ params, url, request, clientAddress }) => {
  if (!limiteCarnets(clientIp(request, clientAddress))) return trop()
  const id = carnetIdSchema.safeParse(params.id)
  const acces = accesCarnetSchema.safeParse({
    projet: url.searchParams.get('projet'),
    cle: url.searchParams.get('cle'),
  })
  if (!id.success) return invalide(id.error.issues)
  if (!acces.success) return invalide(acces.error.issues)
  try {
    return json({ carnet: lireCarnet(getDb(), acces.data.projet, acces.data.cle, id.data) })
  } catch (err) {
    return erreur(err)
  }
}

// Public (widget) : PUT /api/carnets/:id { projet, cle, carnet } — remplace le carnet
export const PUT: APIRoute = async ({ params, request, clientAddress }) => {
  if (!limiteCarnets(clientIp(request, clientAddress))) return trop()
  const id = carnetIdSchema.safeParse(params.id)
  if (!id.success) return invalide(id.error.issues)
  const parsed = ecritureCarnetSchema.safeParse(await readJson(request, MAX_CARNET_CHARS))
  if (!parsed.success) return invalide(parsed.error.issues)
  try {
    const { projet, cle, carnet } = parsed.data
    enregistrerCarnet(getDb(), projet, cle, id.data, carnet)
    return json({ ok: true })
  } catch (err) {
    return erreur(err)
  }
}
