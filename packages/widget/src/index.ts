import { resolveActivation } from './activation'
import { pageUrl, postComment } from './api'
import { mountOverlay } from './overlay'

export type { CommentType } from './types'

export interface FrontNoteOptions {
  /** Identifiant du projet client (ex. 'coress') */
  projectId: string
  /** Adresse du serveur FrontNote (ex. 'https://frontnote.exemple.fr') */
  apiUrl: string
}

let started = false

export function initFrontNote({ projectId, apiUrl }: FrontNoteOptions): void {
  if (typeof window === 'undefined' || started) return

  let active = false
  try {
    active = resolveActivation(projectId, window.location.search, window.localStorage)
  } catch {
    // localStorage indisponible (navigation privée stricte) : widget inactif
    return
  }
  if (!active) return
  started = true

  const start = () =>
    mountOverlay((draft) =>
      postComment(apiUrl, { ...draft, projectId, url: pageUrl(window.location.href) })
    )

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}
