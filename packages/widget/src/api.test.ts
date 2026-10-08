import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkAccess, DELAI_ECRITURE_MS, DELAI_LECTURE_MS, pageUrl, postLot } from './api'
import type { NoteLocale } from './notes'

const note: NoteLocale = {
  idLocal: 'a1',
  numero: 3,
  creeLe: '2026-10-08T10:00:00.000Z',
  url: 'https://coress.fr/',
  selecteur: 'h1',
  x: 0.5,
  y: 0.5,
  type: 'texte',
  appareil: 'ordinateur',
  zone: 'titre « Accueil »',
  texte_attendu: ' Nouveau titre ',
}

afterEach(() => vi.unstubAllGlobals())

describe('pageUrl', () => {
  it("retire le paramètre d'activation et garde le reste", () => {
    expect(pageUrl('https://coress.fr/equipe?frontnote=coress&tab=2#bas')).toBe(
      'https://coress.fr/equipe?tab=2#bas'
    )
  })
})

describe('postLot', () => {
  const lot = { projet: 'coress', cle: '8f3a2c', notes: [note] }

  it('envoie le lot en POST JSON vers /api/corrections/lot et renvoie les ids', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ids: ['REC-004'] }, { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    expect(await postLot('https://api.test/', lot)).toEqual(['REC-004'])

    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.test/api/corrections/lot')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ projet: 'coress', cle: '8f3a2c' })
    // Champs propres au navigateur retirés ; texte du client intact
    expect(body.corrections).toEqual([
      {
        url: 'https://coress.fr/',
        selecteur: 'h1',
        x: 0.5,
        y: 0.5,
        type: 'texte',
        appareil: 'ordinateur',
        zone: 'titre « Accueil »',
        texte_attendu: ' Nouveau titre ',
      },
    ])
  })

  it('traduit les erreurs en message lisible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    await expect(postLot('https://api.test', lot)).rejects.toThrow(/Trop d'envois/)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(postLot('https://api.test', lot)).rejects.toThrow(/Connexion/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })))
    await expect(postLot('https://api.test', lot)).rejects.toThrow(/nouveau lien/)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 410 })))
    await expect(postLot('https://api.test', lot)).rejects.toThrow(/clos/)
  })
})

describe('checkAccess', () => {
  const repond = (body: unknown, status = 200) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))

  it('fait vérifier la clé par /api/projets/:projet/etat', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ouvert: true, active: true }))
    vi.stubGlobal('fetch', fetch)
    expect(await checkAccess('https://api.test/', 'coress', '8f3a2c')).toBe('ok')
    expect(fetch.mock.calls[0]![0]).toBe('https://api.test/api/projets/coress/etat?cle=8f3a2c')
  })

  it('clé refusée, projet clos ou inconnu : le widget ne s’affiche pas', async () => {
    repond({ ouvert: true, active: false })
    expect(await checkAccess('https://api.test', 'coress', 'x')).toBe('refused')
    repond({ ouvert: false, active: false })
    expect(await checkAccess('https://api.test', 'coress', 'x')).toBe('refused')
    repond({ ouvert: false, active: false }, 404)
    expect(await checkAccess('https://api.test', 'coress', 'x')).toBe('refused')
  })

  it('serveur injoignable ou en erreur : l’envoi tranchera', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await checkAccess('https://api.test', 'coress', 'x')).toBe('unreachable')
    repond({}, 503)
    expect(await checkAccess('https://api.test', 'coress', 'x')).toBe('unreachable')
  })
})

// Serveur qui accepte la connexion sans jamais répondre
const muet = () => vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(() => {}))

describe('délai maximum', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('checkAccess : serveur muet → « unreachable » après le délai, requête annulée', async () => {
    const fetch = muet()
    vi.stubGlobal('fetch', fetch)
    let resultat: string | undefined
    void checkAccess('https://api.test', 'coress', 'x').then((r) => (resultat = r))

    await vi.advanceTimersByTimeAsync(DELAI_LECTURE_MS - 1)
    expect(resultat).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(resultat).toBe('unreachable')
    const signal = fetch.mock.calls[0]![1]?.signal
    expect(signal?.aborted).toBe(true)
  })

  it('checkAccess : sans AbortController, le délai rend quand même la main', async () => {
    vi.stubGlobal('AbortController', undefined)
    vi.stubGlobal('fetch', muet())
    const resultat = checkAccess('https://api.test', 'coress', 'x')
    await vi.advanceTimersByTimeAsync(DELAI_LECTURE_MS)
    expect(await resultat).toBe('unreachable')
  })

  it('postLot : patiente plus longtemps, puis message d’erreur réseau', async () => {
    vi.stubGlobal('fetch', muet())
    let erreur: Error | undefined
    void postLot('https://api.test', { projet: 'coress', cle: 'k', notes: [note] }).catch(
      (e: Error) => (erreur = e)
    )

    await vi.advanceTimersByTimeAsync(DELAI_LECTURE_MS)
    expect(erreur).toBeUndefined()
    await vi.advanceTimersByTimeAsync(DELAI_ECRITURE_MS - DELAI_LECTURE_MS)
    expect(erreur?.message).toMatch(/Connexion impossible/)
  })

  it('réponse dans le délai : minuteur retiré', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ active: true })))
    expect(await checkAccess('https://api.test', 'coress', 'x')).toBe('ok')
    expect(vi.getTimerCount()).toBe(0)
  })
})
