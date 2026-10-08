import type { NoteLocale } from './notes'

// URL de la page sans les paramètres du widget (activation, lien de reprise)
export function pageUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('frontnote')
  url.searchParams.delete('carnet')
  return url.toString()
}

export const base = (apiUrl: string) => apiUrl.replace(/\/+$/, '')

export type Access = 'ok' | 'refused' | 'unreachable'

// Le serveur valide-t-il cette clé pour ce projet (ouvert) ? Clos, inconnu ou clé
// refusée → 'refused'. Serveur injoignable → 'unreachable' : l'envoi tranchera.
export async function checkAccess(apiUrl: string, projectId: string, key: string): Promise<Access> {
  try {
    const response = await fetch(
      `${base(apiUrl)}/api/projets/${encodeURIComponent(projectId)}/etat?cle=${encodeURIComponent(key)}`
    )
    if (response.status === 404) return 'refused'
    if (!response.ok) return 'unreachable'
    const { active } = (await response.json()) as { active?: boolean }
    return active === true ? 'ok' : 'refused'
  } catch {
    return 'unreachable'
  }
}

async function envoyerJson(url: string, body: unknown): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Connexion impossible, réessayez dans un instant.')
  }
  if (response.status === 429) {
    throw new Error("Trop d'envois d'un coup, réessayez dans quelques minutes.")
  }
  if (response.status === 403) {
    throw new Error("Lien d'accès périmé : demandez un nouveau lien à l'agence.")
  }
  if (response.status === 410) {
    throw new Error('Ce projet est clos : il ne reçoit plus de retours.')
  }
  if (!response.ok) throw new Error("Les retours n'ont pas pu être envoyés.")
  return response
}

export interface LotPayload {
  projet: string
  cle: string
  notes: NoteLocale[]
}

// Envoie tous les brouillons en une fois (tout ou rien) ; renvoie les ids dans l'ordre.
// apiUrl = adresse du serveur FrontNote (ex. https://frontnote.exemple.fr)
export async function postLot(
  apiUrl: string,
  { projet, cle, notes }: LotPayload
): Promise<string[]> {
  const honey = notes.find((n) => n._honey)?._honey
  const corrections = notes.map(
    ({ idLocal: _i, numero: _n, creeLe: _c, _honey: _h, ...retour }) => retour
  )
  const response = await envoyerJson(`${base(apiUrl)}/api/corrections/lot`, {
    projet,
    cle,
    corrections,
    ...(honey ? { _honey: honey } : {}),
  })
  try {
    const { ids } = (await response.json()) as { ids?: unknown }
    return Array.isArray(ids) ? ids.map(String) : []
  } catch {
    return []
  }
}
