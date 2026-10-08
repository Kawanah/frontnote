import { beforeEach, describe, expect, it } from 'vitest'
import { actionsRapides } from './actions'
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
  it('nouvelle non qualifiée : « Qualifier » vers la fiche, avec les champs manquants', () => {
    const a = actionsRapides(nouvelle())
    expect(a.aTraiter).toBe('qualifier')
    expect(a.manquants).toEqual(['gravité', 'lieu de correction', 'attendu'])
    expect(a.refuser).toBe(true)
  })

  it('nouvelle qualifiée : bouton « À traiter » direct', () => {
    const c = nouvelle()
    expect(actionsRapides(qualifier(c.id))).toEqual({
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
      refuser: false,
    })
  })
})
