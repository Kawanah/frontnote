// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotes, memePage, notesKey } from './notes'
import type { Draft } from './types'

const draft: Draft = {
  selecteur: '#lien',
  x: 0.5,
  y: 0.5,
  type: 'bug',
  appareil: 'mobile',
  zone: 'lien « Réserver »',
  constat: 'Le lien ne marche pas',
}

beforeEach(() => localStorage.clear())

describe('memePage', () => {
  it('ignore ancre, paramètre d’activation et « / » final', () => {
    expect(memePage('https://a.fr/equipe/#bas', 'https://a.fr/equipe?frontnote=x')).toBe(true)
    expect(memePage('https://a.fr/', 'https://a.fr')).toBe(true)
    expect(memePage('https://a.fr/equipe?tab=2', 'https://a.fr/equipe')).toBe(false)
    expect(memePage('https://a.fr/a', 'https://a.fr/b')).toBe(false)
  })
})

describe('carnet de retours', () => {
  it('garde les brouillons d’une visite à l’autre, numérotés sans jamais réattribuer', () => {
    const notes = createNotes('kawanah', localStorage)
    const a = notes.ajouter(draft, 'https://a.fr/')
    const b = notes.ajouter(draft, 'https://a.fr/equipe')
    notes.supprimer(a.idLocal)
    const c = notes.ajouter(draft, 'https://a.fr/')
    expect([a.numero, b.numero, c.numero]).toEqual([1, 2, 3])

    // Nouvelle page : un nouveau store relit le navigateur
    const relu = createNotes('kawanah', localStorage).lire()
    expect(relu.brouillons.map((n) => n.numero)).toEqual([2, 3])
  })

  it('modifie un brouillon, texte du client gardé mot pour mot', () => {
    const notes = createNotes('kawanah', localStorage)
    const a = notes.ajouter(draft, 'https://a.fr/')
    notes.modifier(a.idLocal, {
      type: 'texte',
      texte_attendu: '  Mot  pour mot ',
      constat: undefined,
    })
    const [modifiee] = notes.lire().brouillons
    expect(modifiee).toMatchObject({ type: 'texte', texte_attendu: '  Mot  pour mot ', numero: 1 })
    expect(modifiee!.constat).toBeUndefined()
  })

  it('après envoi : brouillons passés en lecture seule avec l’id du serveur', () => {
    const notes = createNotes('kawanah', localStorage)
    const a = notes.ajouter(draft, 'https://a.fr/')
    const b = notes.ajouter(draft, 'https://a.fr/')
    notes.marquerEnvoyes([a, b], ['KAW-012', 'KAW-013'])
    const carnet = notes.lire()
    expect(carnet.brouillons).toEqual([])
    expect(carnet.envoyes.map((n) => [n.numero, n.id])).toEqual([
      [1, 'KAW-012'],
      [2, 'KAW-013'],
    ])
    expect(notes.ajouter(draft, 'https://a.fr/').numero).toBe(3)
  })

  it('un carnet par projet ; oublier efface tout', () => {
    createNotes('coress', localStorage).ajouter(draft, 'https://c.fr/')
    const notes = createNotes('kawanah', localStorage)
    notes.ajouter(draft, 'https://a.fr/')
    notes.oublier()
    expect(localStorage.getItem(notesKey('kawanah'))).toBeNull()
    expect(createNotes('coress', localStorage).lire().brouillons).toHaveLength(1)
  })

  it('stockage indisponible ou illisible : carnet en mémoire pour la visite', () => {
    const sans = createNotes('kawanah', null)
    sans.ajouter(draft, 'https://a.fr/')
    expect(sans.lire().brouillons).toHaveLength(1)

    localStorage.setItem(notesKey('kawanah'), '{pas du json')
    expect(createNotes('kawanah', localStorage).lire().brouillons).toEqual([])
  })
})

describe('carnet et serveur', () => {
  it('chaque changement du client est daté, identifié et sauvegardé', () => {
    const sauvegarder = vi.fn()
    const notes = createNotes('kawanah', localStorage, sauvegarder)
    notes.ajouter(draft, 'https://a.fr/')
    const carnet = notes.lire()
    expect(carnet.id).toMatch(/^[0-9a-f]{32}$/)
    expect(carnet.majLe).toBeDefined()
    expect(sauvegarder).toHaveBeenCalledWith(carnet)

    // Copie venue du serveur : gardée sans être renvoyée
    notes.remplacer({ ...carnet, prochainNumero: 9 })
    expect(sauvegarder).toHaveBeenCalledTimes(1)
    expect(notes.lire().prochainNumero).toBe(9)
  })

  it('lien de reprise : adopte le carnet du lien, brouillons locaux numérotés à la suite', () => {
    const distant = createNotes('autre', null)
    distant.ajouter(draft, 'https://a.fr/')
    distant.ajouter(draft, 'https://a.fr/')
    const carnetDistant = { ...distant.lire(), id: 'carnet-du-lien-0001' }

    const sauvegarder = vi.fn()
    const vierge = createNotes('kawanah', localStorage, sauvegarder)
    vierge.fusionner(carnetDistant)
    expect(vierge.lire()).toMatchObject({ id: 'carnet-du-lien-0001', prochainNumero: 3 })
    expect(sauvegarder).not.toHaveBeenCalled()

    localStorage.clear()
    const local = createNotes('kawanah', localStorage, sauvegarder)
    local.ajouter({ ...draft, constat: 'local' }, 'https://a.fr/')
    local.fusionner(carnetDistant)
    const fusion = local.lire()
    expect(fusion.id).toBe('carnet-du-lien-0001')
    expect(fusion.brouillons.map((n) => [n.numero, n.constat])).toEqual([
      [1, draft.constat],
      [2, draft.constat],
      [3, 'local'],
    ])
    expect(fusion.prochainNumero).toBe(4)
  })
})
