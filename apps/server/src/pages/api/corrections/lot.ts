import type { APIRoute } from 'astro'
import { creerLotDepuisWidget, LOT_MAX, lotSchema } from '../../../lib/corrections'
import {
  clientIp,
  erreur,
  invalide,
  json,
  MAX_BODY_CHARS,
  preflight,
  readJson,
  tropDeRequetes,
} from '../../../lib/http'
import { limiteSignalements } from '../../../lib/limites'
import { getDb } from '../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Lot de retours validé par le client depuis le widget (public) : tout ou rien.
// Un lot compte pour un seul envoi dans la limite de débit.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!limiteSignalements(clientIp(request, clientAddress))) {
    return tropDeRequetes()
  }

  const parsed = lotSchema.safeParse(await readJson(request, LOT_MAX * MAX_BODY_CHARS))
  if (!parsed.success) return invalide(parsed.error.issues)

  const { _honey, ...lot } = parsed.data
  // Robot détecté : faux succès, rien n'est enregistré
  if (_honey) return json({ ids: [] }, 201)

  try {
    return json({ ids: creerLotDepuisWidget(getDb(), lot) }, 201)
  } catch (err) {
    return erreur(err)
  }
}
