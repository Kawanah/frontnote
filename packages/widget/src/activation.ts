// Activation du widget par lien spécial : ?frontnote=<projectId>
// Le lien active le widget et le mémorise dans le navigateur du client.
// ?frontnote=off le désactive. Les autres visiteurs ne voient rien.

const PARAM = 'frontnote'
const OFF = 'off'

const storageKey = (projectId: string) => `frontnote:active:${projectId}`

export function resolveActivation(projectId: string, search: string, storage: Storage): boolean {
  const value = new URLSearchParams(search).get(PARAM)

  if (value === OFF) {
    storage.removeItem(storageKey(projectId))
    return false
  }

  if (value === projectId) {
    storage.setItem(storageKey(projectId), '1')
    return true
  }

  return storage.getItem(storageKey(projectId)) === '1'
}
