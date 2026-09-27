import { forgetActivation, rememberActivation, resolveActivation } from './activation'
import { checkAccess, pageUrl, postComment } from './api'
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
  let found: string | null
  try {
    storage = window.localStorage
    found = resolveActivation(projectId, window.location.search, storage)
  } catch {
    // localStorage indisponible (navigation privée stricte) : widget inactif
    return
  }
  if (!found) return
  const cle = found
  started = true

  const start = () =>
    mountOverlay((draft) =>
      postComment(apiUrl, {
        ...draft,
        projet: projectId,
        cle,
        url: pageUrl(window.location.href),
        contexte: collectContext(),
      })
    )

  // Clé vérifiée par le serveur. Refusée (mauvaise clé, projet clos ou inconnu) :
  // le widget ne s'affiche pas et oublie l'activation.
  void checkAccess(apiUrl, projectId, cle).then((access) => {
    if (access === 'refused') {
      try {
        forgetActivation(projectId, storage)
      } catch {
        // stockage indisponible : rien à oublier
      }
      return
    }
    if (access === 'ok') {
      try {
        rememberActivation(projectId, cle, storage)
      } catch {
        // stockage refusé : le widget s'affiche pour cette visite seulement
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true })
    } else {
      start()
    }
  })
}
