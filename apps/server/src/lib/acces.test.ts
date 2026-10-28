import { describe, expect, it } from 'vitest'
import { origineRefusee } from './acces'

// Derrière le proxy O2switch, l'adresse vue par Astro est en http
const attendues = ['http://frontnote.kawanah.com', 'https://frontnote.kawanah.com']
const entetes = (valeurs: Record<string, string>) => new Headers(valeurs)

describe('origineRefusee', () => {
  it('accepte un formulaire du dashboard lui-même', () => {
    const headers = entetes({ origin: 'https://frontnote.kawanah.com' })
    expect(origineRefusee('POST', '/projets/kawanah', headers, attendues)).toBe(false)
  })

  it.each([
    ['un sous-domaine', 'https://www.kawanah.com'],
    ['un autre site', 'https://exemple.fr'],
    ['un domaine qui l’imite', 'http://frontnote.kawanah.com.exemple.fr'],
  ])('refuse un formulaire envoyé depuis %s', (_label, origin) => {
    expect(origineRefusee('POST', '/projets/kawanah', entetes({ origin }), attendues)).toBe(true)
    expect(origineRefusee('POST', '/deconnexion', entetes({ origin }), attendues)).toBe(true)
  })

  it('sans Origin, se fie à Sec-Fetch-Site', () => {
    const meme = entetes({ 'sec-fetch-site': 'same-origin' })
    const voisin = entetes({ origin: 'null', 'sec-fetch-site': 'same-site' })
    expect(origineRefusee('POST', '/', meme, attendues)).toBe(false)
    expect(origineRefusee('POST', '/', voisin, attendues)).toBe(true)
    expect(origineRefusee('POST', '/', entetes({}), attendues)).toBe(true)
  })

  it('laisse passer les lectures et l’API (jetons, CORS ouvert)', () => {
    const origin = entetes({ origin: 'https://site-client.fr' })
    expect(origineRefusee('GET', '/projets/kawanah', origin, attendues)).toBe(false)
    expect(origineRefusee('POST', '/api/corrections/lot', origin, attendues)).toBe(false)
    expect(origineRefusee('PATCH', '/api/corrections/KAW-001', origin, attendues)).toBe(false)
  })
})
