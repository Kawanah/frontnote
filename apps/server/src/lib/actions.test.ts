import { beforeEach, describe, expect, it } from 'vitest'
import { actionsRapides, passerATraiter, qualificationParDefaut } from './actions'
import { creerDepuisWidget, getCorrection, mettreAJour, type Correction } from './corrections'
import { openDatabase, type Db } from './db'
import { createProjet, getProjet } from './projets'

const CLE = 'cle-de-test'
let db: Db

beforeEach(() => {
  db = openDatabase(':memory:')
  createProjet(db, { id: 'kawanah', nom: 'Kawanah', prefixe: 'KAW-' })
  db.prepare('UPDATE projets SET cle_activation = ? WHERE id = ?').run(CLE, 'kawanah')
})

function nouvelle(): Correction {
  return creerDepuisWidget(db, {
    projet: 'kawanah',
    cle: CLE,
    url: 'https://kawanah.fr/',
    selecteur: 'h1',
    x: 0.5,
    y: 0.5,
    type: 'image',
    appareil: 'mobile',
    zone: 'image',
    constat: 'Photo floue',
  })
}

const revision = () => getProjet(db, 'kawanah')!.revision
const qualifier = (id: string) =>
  mettreAJour(db, id, 'agence', {
    revision: revision(),
    nature: 'image',
    gravite: 'mineure',
    lieu_correction: 'code',
    attendu: 'Photo nette',
  })

describe('boutons rapides de la liste', () => {
  it('nouvelle sans attendu : saisie dans la ligne, le reste a une valeur par défaut', () => {
    const a = actionsRapides(nouvelle())
    expect(a.aTraiter).toBe('attendu')
    expect(a.manquants).toEqual(['attendu'])
    expect(a.defauts).toMatchObject({ gravite: 'mineure', lieu_correction: 'code' })
    expect(a.defauts.lot).toMatch(/^retours-\d{4}-\d{2}-\d{2}$/)
    expect(a.refuser).toBe(true)
  })

  it('nature inconnue (type « autre ») : passage par la fiche', () => {
    const c = nouvelle()
    db.prepare('UPDATE corrections SET nature = NULL WHERE id = ?').run(c.id)
    const a = actionsRapides(getCorrection(db, c.id)!)
    expect(a.aTraiter).toBe('qualifier')
    expect(a.manquants).toContain('nature')
  })

  it('nouvelle qualifiée : bouton « À traiter » direct', () => {
    const c = nouvelle()
    expect(actionsRapides(qualifier(c.id))).toMatchObject({
      aTraiter: 'bouton',
      manquants: [],
      refuser: true,
    })
  })

  it('suivent transitionsPossibles : rien de plus que ce que l’agence peut faire', () => {
    const c = qualifier(nouvelle().id)
    mettreAJour(db, c.id, 'agence', { revision: revision(), statut: 'a_traiter' })
    // À traiter : plus de bouton « À traiter », refus encore possible
    expect(actionsRapides(getCorrection(db, c.id)!)).toMatchObject({
      aTraiter: null,
      refuser: true,
    })

    mettreAJour(db, c.id, 'agent', { revision: revision(), statut: 'en_cours' })
    // En cours (côté agent) : l'agence ne peut ni passer à traiter ni refuser
    expect(actionsRapides(getCorrection(db, c.id)!)).toEqual({
      aTraiter: null,
      manquants: [],
      defauts: {},
      refuser: false,
    })
  })
})

describe('passage rapide « À traiter »', () => {
  it('pose les valeurs par défaut et l’attendu saisi dans la ligne', () => {
    const c = nouvelle()
    const apres = passerATraiter(db, c, revision(), '  Photo nette  ')
    expect(apres).toMatchObject({
      statut: 'a_traiter',
      gravite: 'mineure',
      lieu_correction: 'code',
      attendu: 'Photo nette',
    })
    expect(apres.historique.at(-1)).toMatchObject({ de: 'nouvelle', vers: 'a_traiter' })
  })

  it('ne remplace rien de ce que l’agence a saisi', () => {
    const c = qualifier(nouvelle().id)
    mettreAJour(db, c.id, 'agence', {
      revision: revision(),
      gravite: 'bloquante',
      lot: 'recette-1',
    })
    const apres = passerATraiter(db, getCorrection(db, c.id)!, revision(), 'autre chose')
    expect(apres).toMatchObject({ gravite: 'bloquante', lot: 'recette-1', attendu: 'Photo nette' })
  })

  it('gravité proposée selon la nature', () => {
    const c = nouvelle()
    expect(qualificationParDefaut({ ...c, nature: 'bug' }).gravite).toBe('majeure')
    expect(qualificationParDefaut({ ...c, nature: 'securite' }).gravite).toBe('bloquante')
    expect(qualificationParDefaut({ ...c, nature: 'contenu_cms' }).lieu_correction).toBe('cms')
    expect(qualificationParDefaut(c, '2026-10-29').lot).toBe('retours-2026-10-29')
  })

  it('sans attendu : refusé comme depuis la fiche', () => {
    const c = nouvelle()
    expect(() => passerATraiter(db, c, revision())).toThrow(/attendu/)
  })
})
