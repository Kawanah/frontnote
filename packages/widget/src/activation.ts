// Activation du widget par lien spécial : ?frontnote=<clé d'activation du projet>
// La clé est vérifiée par le serveur (checkAccess) puis mémorisée dans le navigateur
// du client. ?frontnote=off désactive. Les autres visiteurs ne voient rien.
import { pageUrl } from './api'

const PARAM = 'frontnote'
const CARNET = 'carnet'
const OFF = 'off'

const storageKey = (projectId: string) => `frontnote:active:${projectId}`

// Clé candidate : celle du lien, sinon celle mémorisée. null = widget inactif.
export function resolveActivation(
  projectId: string,
  search: string,
  storage: Storage
): string | null {
  const value = new URLSearchParams(search).get(PARAM)

  if (value === OFF) {
    storage.removeItem(storageKey(projectId))
    return null
  }
  if (value) return value

  const stored = storage.getItem(storageKey(projectId))
  // Ancien format (activation par le nom du projet) : n'active plus rien
  if (stored === '1') {
    storage.removeItem(storageKey(projectId))
    return null
  }
  return stored
}

// Clé acceptée par le serveur : les visites suivantes n'ont plus besoin du lien
export function rememberActivation(projectId: string, key: string, storage: Storage): void {
  storage.setItem(storageKey(projectId), key)
}

// Retour à montrer, transmis par le lien « Voir sur la page » du dashboard dans le
// fragment (#frontnote-voir&id=…&x=…&y=…&s=<sélecteur>) : jamais envoyé au serveur
// du site, et rien n'est relu sur le serveur FrontNote.
const VOIR = '#frontnote-voir&'

export interface Repere {
  id: string
  selecteur: string
  x: number
  y: number
}

export function lireRepere(hash: string): Repere | null {
  if (!hash.startsWith(VOIR)) return null
  const params = new URLSearchParams(hash.slice(VOIR.length))
  const id = params.get('id')
  const selecteur = params.get('s')
  const x = Number(params.get('x'))
  const y = Number(params.get('y'))
  if (!id || !selecteur || !Number.isFinite(x) || !Number.isFinite(y)) return null
  const dans = (n: number) => Math.min(Math.max(n, 0), 1)
  return { id: id.slice(0, 30), selecteur: selecteur.slice(0, 500), x: dans(x), y: dans(y) }
}

// Adresse sans la clé ni le carnet (secrets) ni le repère, ou null s'il n'y a rien
// à retirer. Laissés dans la barre d'adresse, ils partiraient dans les outils de
// mesure du site, les captures d'écran et les liens copiés.
export function adresseSansActivation(href: string): string | null {
  const url = new URL(href)
  const repere = url.hash.startsWith(VOIR)
  if (!repere && !url.searchParams.has(PARAM) && !url.searchParams.has(CARNET)) return null
  if (repere) url.hash = ''
  return pageUrl(url.toString())
}

// Projet clos ou clé refusée : le lien mémorisé ne réactive plus le widget
export function forgetActivation(projectId: string, storage: Storage): void {
  storage.removeItem(storageKey(projectId))
}
