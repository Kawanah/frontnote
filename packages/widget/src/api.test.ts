import { afterEach, describe, expect, it, vi } from 'vitest'
import { pageUrl, postComment, projectOpen, type CommentPayload } from './api'

const payload: CommentPayload = {
  projet: 'coress',
  url: 'https://coress.fr/',
  selecteur: 'h1',
  x: 0.5,
  y: 0.5,
  type: 'texte',
  appareil: 'ordinateur',
  zone: 'titre « Accueil »',
  texte_attendu: 'Nouveau titre',
}

afterEach(() => vi.unstubAllGlobals())

describe('pageUrl', () => {
  it("retire le paramètre d'activation et garde le reste", () => {
    expect(pageUrl('https://coress.fr/equipe?frontnote=coress&tab=2#bas')).toBe(
      'https://coress.fr/equipe?tab=2#bas'
    )
  })
})

describe('postComment', () => {
  it('envoie en POST JSON vers /api/corrections', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    await postComment('https://api.test/', payload)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/corrections',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) })
    )
  })

  it('traduit les erreurs en message lisible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    await expect(postComment('https://api.test', payload)).rejects.toThrow(/Trop d'envois/)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(postComment('https://api.test', payload)).rejects.toThrow(/Connexion/)
  })
})

describe('projectOpen', () => {
  const repond = (body: unknown, status = 200) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))

  it('interroge /api/projets/:projet/etat', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ouvert: true }))
    vi.stubGlobal('fetch', fetch)
    expect(await projectOpen('https://api.test/', 'coress')).toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://api.test/api/projets/coress/etat')
  })

  it('projet clos ou inconnu : le widget ne s’affiche pas', async () => {
    repond({ ouvert: false })
    expect(await projectOpen('https://api.test', 'coress')).toBe(false)
    repond({ ouvert: false }, 404)
    expect(await projectOpen('https://api.test', 'coress')).toBe(false)
  })

  it('serveur injoignable ou en erreur : le widget s’affiche quand même', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await projectOpen('https://api.test', 'coress')).toBe(true)
    repond({}, 503)
    expect(await projectOpen('https://api.test', 'coress')).toBe(true)
  })
})
