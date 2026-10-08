// Carnet de retours du client, gardé dans son navigateur (toutes pages du site).
// Les brouillons restent modifiables jusqu'à l'envoi du lot ; les retours envoyés
// sont gardés en lecture seule pour que le client sache ce qu'il a déjà dit.
import type { TechContext } from './context'
import type { Draft } from './types'

export interface NoteLocale extends Draft {
  idLocal: string
  /** Numéro affiché sur le pin et la carte ; jamais réattribué */
  numero: number
  url: string
  contexte?: TechContext
  creeLe: string
}

export interface NoteEnvoyee extends NoteLocale {
  /** Identifiant donné par le serveur (ex. KAW-012) */
  id: string
  envoyeLe: string
}

export interface Carnet {
  /** Identifiant secret du carnet sur le serveur (lien de reprise) */
  id?: string
  /** Dernière modification : départage la copie locale et celle du serveur */
  majLe?: string
  prochainNumero: number
  brouillons: NoteLocale[]
  envoyes: NoteEnvoyee[]
}

// Au-delà, les plus anciens retours envoyés sont oubliés
const ENVOYES_MAX = 200
// Un lot envoyé compte 50 retours au plus (limite du serveur)
export const BROUILLONS_MAX = 50

const vide = (): Carnet => ({ prochainNumero: 1, brouillons: [], envoyes: [] })

export const notesKey = (projectId: string) => `frontnote:notes:${projectId}`

// Même page : sans l'ancre ni le paramètre d'activation, « / » final ignoré
export function memePage(a: string, b: string): boolean {
  const norme = (href: string) => {
    try {
      const url = new URL(href)
      url.hash = ''
      url.searchParams.delete('frontnote')
      url.searchParams.delete('carnet')
      url.pathname = url.pathname.replace(/\/+$/, '') || '/'
      return url.toString()
    } catch {
      return href
    }
  }
  return norme(a) === norme(b)
}

function valide(value: unknown): value is Carnet {
  const c = value as Carnet | null
  return (
    !!c &&
    typeof c.prochainNumero === 'number' &&
    Array.isArray(c.brouillons) &&
    Array.isArray(c.envoyes)
  )
}

// 128 bits aléatoires (randomUUID n'existe pas sur un site en http)
export function nouvelId(): string {
  const octets = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

export const carnetIdValide = (id: string | null | undefined): id is string =>
  !!id && /^[A-Za-z0-9_-]{16,64}$/.test(id)

export type NotesStore = ReturnType<typeof createNotes>

// storage null (navigation privée stricte) : carnet gardé en mémoire pour la visite.
// sauvegarder : appelé après chaque changement fait par le client (copie serveur).
export function createNotes(
  projectId: string,
  storage: Storage | null,
  sauvegarder: (carnet: Carnet) => void = () => {}
) {
  const key = notesKey(projectId)
  let memoire = vide()

  // Relu à chaque fois : un autre onglet a pu écrire entre-temps
  function lire(): Carnet {
    if (!storage) return memoire
    try {
      const brut = storage.getItem(key)
      const parsed: unknown = brut ? JSON.parse(brut) : null
      memoire = valide(parsed) ? parsed : vide()
    } catch {
      // stockage illisible : on garde la dernière version connue
    }
    return memoire
  }

  function garder(carnet: Carnet): Carnet {
    memoire = carnet
    try {
      storage?.setItem(key, JSON.stringify(carnet))
    } catch {
      // stockage plein ou refusé : le carnet vit en mémoire pour cette visite
    }
    return carnet
  }

  // Changement fait par le client : daté, identifié, puis copié sur le serveur
  function ecrire(carnet: Carnet): Carnet {
    garder({ ...carnet, id: carnet.id ?? nouvelId(), majLe: new Date().toISOString() })
    sauvegarder(memoire)
    return memoire
  }

  return {
    key,
    lire,

    ajouter(draft: Draft, url: string, contexte?: TechContext): NoteLocale {
      const carnet = lire()
      const note: NoteLocale = {
        ...draft,
        idLocal: nouvelId(),
        numero: carnet.prochainNumero,
        url,
        contexte,
        creeLe: new Date().toISOString(),
      }
      ecrire({
        ...carnet,
        prochainNumero: carnet.prochainNumero + 1,
        brouillons: [...carnet.brouillons, note],
      })
      return note
    },

    modifier(idLocal: string, changes: Partial<Draft>): void {
      const carnet = lire()
      ecrire({
        ...carnet,
        brouillons: carnet.brouillons.map((n) =>
          n.idLocal === idLocal ? { ...n, ...changes } : n
        ),
      })
    },

    supprimer(idLocal: string): void {
      const carnet = lire()
      ecrire({ ...carnet, brouillons: carnet.brouillons.filter((n) => n.idLocal !== idLocal) })
    },

    // Lot accepté : ids du serveur dans l'ordre des notes envoyées
    marquerEnvoyes(notes: NoteLocale[], ids: string[]): void {
      const carnet = lire()
      const envoyeLe = new Date().toISOString()
      const envoyees = notes.map((n, i) => ({ ...n, id: ids[i] ?? '', envoyeLe }))
      const parti = new Set(notes.map((n) => n.idLocal))
      ecrire({
        ...carnet,
        brouillons: carnet.brouillons.filter((n) => !parti.has(n.idLocal)),
        envoyes: [...carnet.envoyes, ...envoyees].slice(-ENVOYES_MAX),
      })
    },

    // Copie du serveur plus récente (autre appareil, cache vidé) : remplace la copie locale
    remplacer(distant: Carnet): void {
      garder(distant)
    },

    // Lien de reprise ouvert dans un navigateur qui a déjà ses propres brouillons :
    // ceux-ci rejoignent le carnet du lien, numérotés à la suite
    fusionner(distant: Carnet & { id: string }): void {
      const local = lire()
      if (!local.brouillons.length) {
        garder({ ...distant, envoyes: fusionnerEnvoyes(distant.envoyes, local.envoyes) })
        return
      }
      let numero = distant.prochainNumero
      const venus = local.brouillons.map((n) => ({ ...n, numero: numero++ }))
      ecrire({
        ...distant,
        prochainNumero: numero,
        brouillons: [...distant.brouillons, ...venus],
        envoyes: fusionnerEnvoyes(distant.envoyes, local.envoyes),
      })
    },

    // Projet clos ou lien refusé : rien ne doit rester dans le navigateur
    oublier(): void {
      memoire = vide()
      try {
        storage?.removeItem(key)
      } catch {
        // rien à oublier
      }
    },
  }
}

function fusionnerEnvoyes(a: NoteEnvoyee[], b: NoteEnvoyee[]): NoteEnvoyee[] {
  const vus = new Set(a.map((n) => n.idLocal))
  return [...a, ...b.filter((n) => !vus.has(n.idLocal))].slice(-ENVOYES_MAX)
}
