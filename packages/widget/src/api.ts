import type { TechContext } from './context'
import type { Draft } from './types'

export interface CommentPayload extends Draft {
  projet: string
  cle: string
  url: string
  contexte?: TechContext
}

// URL de la page sans le paramètre d'activation
export function pageUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('frontnote')
  return url.toString()
}

const base = (apiUrl: string) => apiUrl.replace(/\/+$/, '')

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

// apiUrl = adresse du serveur FrontNote (ex. https://frontnote.exemple.fr)
export async function postComment(apiUrl: string, payload: CommentPayload): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${base(apiUrl)}/api/corrections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  if (!response.ok) throw new Error("Le retour n'a pas pu être envoyé.")
}
