import { describe, expect, it } from 'vitest'
import { avecParam, filtreDepuisParams, requeteFiltre, voisines } from './navigation'
import { STATUTS_FERMES } from './vocabulaire'

const params = (texte: string) => new URLSearchParams(texte)

describe('filtre partagé entre la liste et la fiche', () => {
  it('par défaut : les demandes ouvertes', () => {
    const { statut } = filtreDepuisParams(params(''))
    expect(statut?.length).toBeGreaterThan(0)
    expect(statut?.some((s) => STATUTS_FERMES.includes(s))).toBe(false)
  })

  it('lit statut, nature, appareil et lot ; ignore les valeurs inconnues', () => {
    expect(
      filtreDepuisParams(params('statut=nouvelle&nature=texte&appareil=mobile&lot=r1'))
    ).toEqual({ statut: ['nouvelle'], nature: 'texte', appareil: 'mobile', lot: 'r1' })
    expect(filtreDepuisParams(params('statut=toutes&nature=x&appareil=y'))).toEqual({
      statut: undefined,
      nature: undefined,
      appareil: undefined,
      lot: undefined,
    })
  })

  it('garde seulement les paramètres de filtre renseignés', () => {
    expect(requeteFiltre(params('statut=nouvelle&ok&fait=KAW-001&lot='))).toBe('?statut=nouvelle')
    expect(requeteFiltre(params('ok'))).toBe('')
    expect(avecParam('', 'ok')).toBe('?ok')
    expect(avecParam('?statut=nouvelle', 'ok')).toBe('?statut=nouvelle&ok')
  })
})

describe('précédente et suivante', () => {
  const ids = ['KAW-003', 'KAW-002', 'KAW-001']

  it('suivent l’ordre de la liste filtrée', () => {
    expect(voisines(ids, 'KAW-002')).toEqual({ precedente: 'KAW-003', suivante: 'KAW-001' })
  })

  it('aux extrémités, un seul sens ; hors de la liste, aucun', () => {
    expect(voisines(ids, 'KAW-003')).toEqual({ precedente: undefined, suivante: 'KAW-002' })
    expect(voisines(ids, 'KAW-001')).toEqual({ precedente: 'KAW-002', suivante: undefined })
    expect(voisines(ids, 'KAW-009')).toEqual({})
  })
})
