import { describe, expect, it } from 'vitest'
import { lienVoir } from './affichage'

const c = {
  id: 'MON-001',
  url: 'https://monstade.fr/tarifs?tab=2#prix',
  selecteur: 'main > div:nth-of-type(3) > p',
  x: 0.42,
  y: 0.31,
}

describe('lienVoir', () => {
  it('active le widget et passe le retour à montrer dans le fragment', () => {
    const lien = new URL(lienVoir(c, 'cle123')!)
    expect(lien.origin + lien.pathname).toBe('https://monstade.fr/tarifs')
    expect(lien.searchParams.get('tab')).toBe('2')
    expect(lien.searchParams.get('frontnote')).toBe('cle123')
    expect(lien.hash.startsWith('#frontnote-voir&')).toBe(true)
    const repere = new URLSearchParams(lien.hash.slice('#frontnote-voir&'.length))
    expect(Object.fromEntries(repere)).toEqual({
      id: 'MON-001',
      x: '0.42',
      y: '0.31',
      s: 'main > div:nth-of-type(3) > p',
    })
  })

  it('sans position : la page seule, widget activé', () => {
    expect(lienVoir({ ...c, selecteur: null }, 'cle123')).toBe(
      'https://monstade.fr/tarifs?tab=2&frontnote=cle123'
    )
  })

  it('rien sans adresse ni clé', () => {
    expect(lienVoir({ ...c, url: null }, 'cle123')).toBeNull()
    expect(lienVoir(c, null)).toBeNull()
    expect(lienVoir({ ...c, url: 'pas une adresse' }, 'cle123')).toBeNull()
  })
})
