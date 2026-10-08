// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotes, type Carnet, type NotesStore } from './notes'
import { createSync } from './sync'
import type { Draft } from './types'

const draft: Draft = {
  selecteur: 'h1',
  x: 0.5,
  y: 0.5,
  type: 'bug',
  appareil: 'mobile',
  zone: 'titre',
  constat: 'Coquille',
}

let notes: NotesStore
let sync: ReturnType<typeof createSync>

beforeEach(() => {
  // Minuteurs simulés : aucune sauvegarde ne part après la fin d'un test
  vi.useFakeTimers()
  localStorage.clear()
  sync = createSync({
    apiUrl: 'https://api.test/',
    projet: 'kawanah',
    cle: 'k',
    notes: () => notes,
  })
  notes = createNotes('kawanah', localStorage, () => sync.planifier())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const repond = (body: unknown, status = 200) => {
  const fetch = vi.fn().mockResolvedValue(Response.json(body, { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('sauvegarde du carnet', () => {
  it('regroupe les changements en une écriture PUT, sans l’identifiant dans le corps', async () => {
    const fetch = repond({ ok: true })
    const etats: string[] = []
    sync.ecouter((e) => etats.push(e))

    notes.ajouter(draft, 'https://a.fr/')
    notes.ajouter(draft, 'https://a.fr/')
    expect(sync.etat).toBe('attente')
    await vi.advanceTimersByTimeAsync(1100)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]!
    const { id } = notes.lire()
    expect(url).toBe(`https://api.test/api/carnets/${id}`)
    expect(init.method).toBe('PUT')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ projet: 'kawanah', cle: 'k' })
    expect(body.carnet.brouillons).toHaveLength(2)
    expect(body.carnet.id).toBeUndefined()
    expect(etats[etats.length - 1]).toBe('ok')
  })

  it('serveur injoignable : état « erreur », brouillons gardés', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    notes.ajouter(draft, 'https://a.fr/')
    await vi.advanceTimersByTimeAsync(1100)
    expect(sync.etat).toBe('erreur')
    expect(notes.lire().brouillons).toHaveLength(1)
  })
})

describe('récupération au chargement', () => {
  const distant = (patch: Partial<Carnet> = {}): Carnet => ({
    prochainNumero: 5,
    majLe: '2030-01-01T00:00:00.000Z',
    brouillons: [],
    envoyes: [],
    ...patch,
  })

  it('cache vidé + lien de reprise : le carnet revient du serveur', async () => {
    const fetch = repond({ carnet: distant() })
    await sync.recuperer('carnet-du-lien-0001')
    expect(fetch.mock.calls[0]![0]).toBe(
      'https://api.test/api/carnets/carnet-du-lien-0001?projet=kawanah&cle=k'
    )
    expect(notes.lire()).toMatchObject({ id: 'carnet-du-lien-0001', prochainNumero: 5 })
  })

  it('copie du serveur plus récente (autre appareil) : elle remplace la locale', async () => {
    notes.ajouter(draft, 'https://a.fr/')
    repond({ carnet: distant() })
    await sync.recuperer(null)
    expect(notes.lire().prochainNumero).toBe(5)
  })

  it('copie locale plus récente ou absente du serveur : elle y est renvoyée', async () => {
    repond({ ok: true })
    notes.ajouter(draft, 'https://a.fr/')
    await vi.advanceTimersByTimeAsync(1100)
    const fetch = repond({ error: 'Carnet introuvable' }, 404)
    await sync.recuperer(null)
    await vi.advanceTimersByTimeAsync(1100)
    expect(fetch.mock.calls[fetch.mock.calls.length - 1]![1].method).toBe('PUT')
  })

  it('identifiant de lien invalide : ignoré', async () => {
    const fetch = repond({})
    await sync.recuperer('<script>')
    expect(fetch).not.toHaveBeenCalled()
  })
})
