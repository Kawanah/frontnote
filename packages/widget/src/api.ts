import type { Draft } from './types'

export interface CommentPayload extends Draft {
  projectId: string
  url: string
}

// URL de la page sans le paramètre d'activation
export function pageUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('frontnote')
  return url.toString()
}

// apiUrl = adresse du serveur FrontNote (ex. https://frontnote.exemple.fr)
export async function postComment(apiUrl: string, payload: CommentPayload): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/comments`, {
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
  if (!response.ok) throw new Error("Le retour n'a pas pu être envoyé.")
}
