import {
  adresseSansActivation,
  forgetActivation,
  rememberActivation,
  resolveActivation,
} from './activation'
import { checkAccess, postLot } from './api'
import { createNotes } from './notes'
import { mountOverlay } from './overlay'
import { createSync } from './sync'

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

  // Lus avant de nettoyer l'adresse : la clé et le carnet n'y restent pas
  const search = window.location.search
  const carnetLien = new URLSearchParams(search).get('carnet')
  const propre = adresseSansActivation(window.location.href)
  if (propre) {
    try {
      window.history.replaceState(window.history.state, '', propre)
    } catch {
      // historique inaccessible (iframe isolée) : l'adresse garde ses paramètres
    }
  }

  let storage: Storage
  let found: string | null
  try {
    storage = window.localStorage
    found = resolveActivation(projectId, search, storage)
  } catch {
    // localStorage indisponible (navigation privée stricte) : widget inactif
    return
  }
  if (!found) return
  const cle = found
  started = true

  // Retours gardés dans le navigateur jusqu'à l'envoi du lot, copiés sur le serveur
  const sync = createSync({ apiUrl, projet: projectId, cle, notes: () => notes })
  const notes = createNotes(projectId, storage, () => sync.planifier())

  // Lien pour retrouver ses retours ailleurs : ?frontnote=<clé>&carnet=<id>
  const lienReprise = () => {
    const id = notes.lire().id
    if (!id) return null
    const url = new URL(window.location.pathname, window.location.origin)
    url.searchParams.set('frontnote', cle)
    url.searchParams.set('carnet', id)
    return url.toString()
  }

  const start = () =>
    mountOverlay({
      notes,
      envoyer: (brouillons) => postLot(apiUrl, { projet: projectId, cle, notes: brouillons }),
      sauvegarde: sync,
      lienReprise,
    })

  // Clé vérifiée par le serveur. Refusée (mauvaise clé, projet clos ou inconnu) :
  // le widget ne s'affiche pas et oublie l'activation.
  void checkAccess(apiUrl, projectId, cle).then(async (access) => {
    if (access === 'refused') {
      try {
        forgetActivation(projectId, storage)
      } catch {
        // stockage indisponible : rien à oublier
      }
      notes.oublier()
      return
    }
    if (access === 'ok') {
      try {
        rememberActivation(projectId, cle, storage)
      } catch {
        // stockage refusé : le widget s'affiche pour cette visite seulement
      }
      // Copie la plus récente entre ce navigateur et le serveur (ou carnet du lien de reprise)
      await sync.recuperer(carnetLien)
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true })
    } else {
      start()
    }
  })
}
