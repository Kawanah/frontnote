import { afterEach, describe, expect, it, vi } from 'vitest'
import { pageUrl, postComment, type CommentPayload } from './api'

const payload: CommentPayload = {
  projectId: 'coress',
  url: 'https://coress.fr/',
  selector: 'h1',
  x: 0.5,
  y: 0.5,
  type: 'texte',
  priority: 'a-corriger',
  message: 'corriger le titre',
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
  it('envoie en POST JSON vers /api/comments', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    await postComment('https://api.test/', payload)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.test/api/comments',
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
