import { resolveActivation } from './activation'

export interface FrontNoteOptions {
  /** Identifiant du projet client (ex. 'coress') */
  projectId: string
  /** URL de l'API centrale FrontNote */
  apiUrl: string
}

export function initFrontNote(options: FrontNoteOptions): void {
  if (typeof window === 'undefined') return

  let active = false
  try {
    active = resolveActivation(options.projectId, window.location.search, window.localStorage)
  } catch {
    // localStorage indisponible (navigation privée stricte) : widget inactif
    return
  }
  if (!active) return

  // Overlay, pins et formulaire : prochaine étape
  console.info(`[FrontNote] actif sur le projet « ${options.projectId} »`)
}
