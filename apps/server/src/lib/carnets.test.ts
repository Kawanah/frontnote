import { beforeEach, describe, expect, it } from 'vitest'
import { carnetSchema, enregistrerCarnet, lireCarnet, type Carnet } from './carnets'
import { clore } from './corrections'
import { openDatabase, type Db } from './db'
import { DomainError } from './errors'
import { createProjet } from './projets'

const CLE = 'cle-de-test'
const ID = '0b8e6f0e-6f3a-4c1e-9d55-6a1f1c2b3d4e'

const carnet: Carnet = {
  prochainNumero: 2,
  majLe: '2026-10-08T10:00:00.000Z',
  brouillons: [
    {
      idLocal: 'a1',
      numero: 1,
      creeLe: '2026-10-08T10:00:00.000Z',
      url: 'https://kawanah.fr/',
      selecteur: 'h1',
      x: 0.5,
      y: 0.5,
      type: 'texte',
      appareil: 'mobile',
      zone: 'titre « Accueil »',
      texte_attendu: '  Mot  pour mot ',
    },
  ],
  envoyes: [],
}

let db: Db
beforeEach(() => {
  db = openDatabase(':memory:')
  for (const id of ['kawanah', 'coress']) {
    createProjet(db, { id, nom: id, prefixe: `${id.slice(0, 3).toUpperCase()}-` })
    db.prepare('UPDATE projets SET cle_activation = ? WHERE id = ?').run(CLE, id)
  }
})

function statut(fn: () => unknown): number {
  try {
    fn()
  } catch (err) {
    if (err instanceof DomainError) return err.status
    throw err
  }
  return 200
}

describe('carnets du widget', () => {
  it('enregistre puis relit le carnet, texte du client intact', () => {
    enregistrerCarnet(db, 'kawanah', CLE, ID, carnet)
    expect(lireCarnet(db, 'kawanah', CLE, ID)).toEqual(carnet)

    const suite = { ...carnet, prochainNumero: 3, brouillons: [] }
    enregistrerCarnet(db, 'kawanah', CLE, ID, suite)
    expect(lireCarnet(db, 'kawanah', CLE, ID)).toEqual(suite)
  })

  it('exige la clé du projet, cloisonne les projets, 404 si inconnu', () => {
    enregistrerCarnet(db, 'kawanah', CLE, ID, carnet)
    expect(statut(() => lireCarnet(db, 'kawanah', 'faux', ID))).toBe(403)
    expect(statut(() => enregistrerCarnet(db, 'kawanah', 'faux', ID, carnet))).toBe(403)
    expect(statut(() => lireCarnet(db, 'coress', CLE, ID))).toBe(404)
    expect(statut(() => enregistrerCarnet(db, 'coress', CLE, ID, carnet))).toBe(409)
    expect(statut(() => lireCarnet(db, 'kawanah', CLE, 'autre-carnet-inconnu'))).toBe(404)
  })

  it('clore le projet efface ses carnets', () => {
    enregistrerCarnet(db, 'kawanah', CLE, ID, carnet)
    clore(db, 'kawanah')
    expect(db.prepare('SELECT count(*) AS n FROM carnets').get()).toEqual({ n: 0 })
  })

  it('oublie les carnets abandonnés depuis plus de 180 jours', () => {
    enregistrerCarnet(db, 'kawanah', CLE, ID, carnet)
    db.prepare('UPDATE carnets SET mis_a_jour_le = ?').run('2020-01-01T00:00:00.000Z')
    enregistrerCarnet(db, 'kawanah', CLE, 'un-autre-carnet-bien-long', carnet)
    expect(statut(() => lireCarnet(db, 'kawanah', CLE, ID))).toBe(404)
  })

  it('valide le contenu du carnet', () => {
    expect(carnetSchema.safeParse(carnet).success).toBe(true)
    expect(
      carnetSchema.safeParse({ ...carnet, brouillons: Array(51).fill(carnet.brouillons[0]) })
        .success
    ).toBe(false)
    expect(carnetSchema.safeParse({ ...carnet, brouillons: [{ numero: 1 }] }).success).toBe(false)
  })
})
