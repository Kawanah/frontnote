import { forgetActivation, resolveActivation } from './activation'
import { pageUrl, postComment, projectOpen } from './api'
import { collectContext } from './context'
import { mountOverlay } from './overlay'

export type { Appareil, CommentType } from './types'

export interface FrontNoteOptions {
  /** Identifiant du projet client (ex. 'coress') */
  projectId: string
  /** Adresse du serveur FrontNote (ex. 'https://frontnote.exemple.fr') */
  apiUrl: string
}

let started = false

export function initFrontNote({ projectId, apiUrl }: FrontNoteOptions): void {
  if (typeof window === 'undefined' || started) return

  let storage: Storage
  try {
    storage = window.localStorage
    if (!resolveActivation(projectId, window.location.search, storage)) return
  } catch {
    // localStorage indisponible (navigation privée stricte) : widget inactif
    return
  }
  started = true

  const start = () =>
    mountOverlay((draft) =>
      postComment(apiUrl, {
        ...draft,
        projet: projectId,
        url: pageUrl(window.location.href),
        contexte: collectContext(),
      })
    )

  // Projet clos : le widget disparaît du site et oublie son activation
  void projectOpen(apiUrl, projectId).then((open) => {
    if (!open) {
      forgetActivation(projectId, storage)
      return
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true })
    } else {
      start()
    }
  })
}
