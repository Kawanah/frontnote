import type { APIRoute } from 'astro'
import { creerDepuisWidget, signalementSchema } from '../../../lib/corrections'
import {
  clientIp,
  erreur,
  invalide,
  json,
  preflight,
  readJson,
  tropDeRequetes,
} from '../../../lib/http'
import { limiteSignalements } from '../../../lib/limites'
import { getDb } from '../../../lib/runtime'

export const OPTIONS: APIRoute = () => preflight()

// Signalement envoyé par le widget (public) : crée une correction « nouvelle »
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!limiteSignalements(clientIp(request, clientAddress))) {
    return tropDeRequetes()
  }

  const parsed = signalementSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalide(parsed.error.issues)

  const { _honey, ...signalement } = parsed.data
  // Robot détecté : faux succès, rien n'est enregistré
  if (_honey) return json({ ok: true }, 201)

  try {
    const { id } = creerDepuisWidget(getDb(), signalement)
    return json({ id }, 201)
  } catch (err) {
    return erreur(err)
  }
}
