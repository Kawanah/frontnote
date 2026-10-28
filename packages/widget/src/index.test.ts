// @vitest-environment happy-dom
// Garde-fou : la clé d'activation et le carnet ne restent jamais dans l'adresse
// (outils de mesure du site, captures, liens copiés). Teste initFrontNote lui-même,
// pas seulement adresseSansActivation : retirer l'appel doit faire échouer ce test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const CLE = '8f3a2c4d5e6f708192a3b4c5'
const CARNET = '0123456789abcdef0123456789abcdef'

async function demarrer(adresse: string) {
  window.history.replaceState(null, '', adresse)
  // started est propre au module : un module neuf par test
  vi.resetModules()
  const { initFrontNote } = await import('./index')
  initFrontNote({ projectId: 'demo', apiUrl: 'https://api.test' })
}

let fetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  fetch = vi.fn(async (url: string) =>
    url.includes('/etat')
      ? Response.json({ ouvert: true, active: true })
      : Response.json({ error: 'Carnet introuvable' }, { status: 404 })
  )
  vi.stubGlobal('fetch', fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelector('frontnote-root')?.remove()
})

describe('initFrontNote', () => {
  it('retire la clé et le carnet de l’adresse, garde le reste', async () => {
    await demarrer(`/equipe?tab=2&frontnote=${CLE}&carnet=${CARNET}#bas`)

    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/equipe?tab=2#bas'
    )
  })

  it('reste actif après le nettoyage : clé vérifiée, mémorisée, carnet du lien relu', async () => {
    await demarrer(`/equipe?frontnote=${CLE}&carnet=${CARNET}`)

    await vi.waitFor(() => expect(localStorage.getItem('frontnote:active:demo')).toBe(CLE))
    const appels = fetch.mock.calls.map(([url]) => String(url))
    expect(appels[0]).toContain(`/etat?cle=${CLE}`)
    // Le carnet a été lu avant que l'adresse ne soit nettoyée
    await vi.waitFor(() =>
      expect(fetch.mock.calls.some(([url]) => String(url).includes(`/api/carnets/${CARNET}`))).toBe(
        true
      )
    )
  })

  it('retire aussi ?frontnote=off', async () => {
    await demarrer('/?frontnote=off')

    expect(window.location.search).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })
})
