import { describe, expect, it } from 'vitest'
import {
  avecParam,
  filtreDepuisParams,
  lienListe,
  ONGLETS,
  ongletDepuisParams,
  requeteFiltre,
  voisines,
} from './navigation'
import { STATUTS, STATUTS_FERMES } from './vocabulaire'

const params = (texte: string) => new URLSearchParams(texte)

describe('filtre partagé entre la liste et la fiche', () => {
  it('par défaut : l’onglet « À qualifier »', () => {
    expect(ongletDepuisParams(params(''))).toBe('qualifier')
    expect(filtreDepuisParams(params('')).statut).toEqual(['nouvelle'])
  })

  it('un onglet regroupe ses statuts ; les anciens liens par statut marchent encore', () => {
    expect(filtreDepuisParams(params('statut=fermees')).statut).toEqual([...STATUTS_FERMES])
    expect(filtreDepuisParams(params('statut=en_cours')).statut).toContain('question_client')
    expect(ongletDepuisParams(params('statut=corrigee'))).toBeNull()
    expect(filtreDepuisParams(params('statut=corrigee')).statut).toEqual(['corrigee'])
  })

  it('chaque statut est dans un seul onglet', () => {
    const tous = ONGLETS.flatMap((o) => o.statuts)
    expect(new Set(tous).size).toBe(tous.length)
    expect(tous.length).toBe(STATUTS.length)
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

  it('lien de retour à la liste : « ? » s’il n’y a pas de filtre', () => {
    expect(lienListe('monstade', '', 'fait=MON-005')).toBe('/projets/monstade?fait=MON-005')
    expect(lienListe('monstade', '?statut=en_cours', 'fait=MON-005')).toBe(
      '/projets/monstade?statut=en_cours&fait=MON-005'
    )
    expect(lienListe('monstade', '?statut=en_cours')).toBe('/projets/monstade?statut=en_cours')
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
