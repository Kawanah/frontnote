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

// Adresse sans la clé ni le carnet (secrets), ou null s'il n'y a rien à retirer.
// Laissés dans la barre d'adresse, ils partiraient dans les outils de mesure du
// site, les captures d'écran et les liens copiés.
export function adresseSansActivation(href: string): string | null {
  const { searchParams } = new URL(href)
  return searchParams.has(PARAM) || searchParams.has(CARNET) ? pageUrl(href) : null
}

// Projet clos ou clé refusée : le lien mémorisé ne réactive plus le widget
export function forgetActivation(projectId: string, storage: Storage): void {
  storage.removeItem(storageKey(projectId))
}
