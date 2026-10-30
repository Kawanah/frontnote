import type { APIRoute } from 'astro'
import { exporterProjet } from '../../../../lib/exportAgent'
import { roleFor, SESSION_COOKIE, sessionValide } from '../../../../lib/auth'
import { filtreSchema } from '../../../../lib/corrections'
import { erreur, invalide, json } from '../../../../lib/http'
import { getProjet } from '../../../../lib/projets'
import { dashboardToken, getDb } from '../../../../lib/runtime'

// Vue agent : export filtré au format du contrat (§ 6 et § 8)
// GET /api/projets/kawanah/corrections?statut=a_traiter&lot=...
export const GET: APIRoute = ({ request, params, url, cookies }) => {
  const db = getDb()
  const projet = getProjet(db, params.projet ?? '')
  if (!projet) return json({ error: 'Projet inconnu' }, 404)

  // Jeton (agent ou agence), ou session du dashboard pour consulter la vue dans le navigateur
  const role =
    roleFor(request.headers.get('authorization'), dashboardToken, projet.jeton_agent) ??
    (sessionValide(cookies.get(SESSION_COOKIE)?.value, dashboardToken) ? 'agence' : null)
  if (!role) return json({ error: 'Non autorisé' }, 401)

  const parsed = filtreSchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return invalide(parsed.error.issues)

  try {
    return json(exporterProjet(db, projet.id, parsed.data))
  } catch (err) {
    return erreur(err)
  }
}
