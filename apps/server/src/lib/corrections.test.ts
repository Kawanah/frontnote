import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  creerDepuisWidget,
  exporterProjet,
  listCorrections,
  mettreAJour,
  miseAJourAgentSchema,
  signalementSchema,
  transitionsPossibles,
  type Signalement,
} from './corrections'
import { MIGRATIONS, openDatabase, userVersion, type Db } from './db'
import { DomainError } from './errors'
import { createProjet, getProjet } from './projets'

const signalement: Omit<Signalement, '_honey'> = {
  projet: 'kawanah',
  url: 'https://kawanah.fr/a-propos?frontnote=kawanah',
  selecteur: 'main > p:nth-of-type(2)',
  x: 0.4,
  y: 0.5,
  type: 'image',
  appareil: 'mobile',
  zone: 'paragraphe « Notre équipe »',
  constat: 'La photo est floue',
}

let db: Db
beforeEach(() => {
  db = openDatabase(':memory:')
  createProjet(db, { id: 'kawanah', nom: 'Kawanah Studio' })
})

const revision = () => getProjet(db, 'kawanah')!.revision

function erreurDe(fn: () => unknown): DomainError {
  try {
    fn()
  } catch (err) {
    if (err instanceof DomainError) return err
    throw err
  }
  throw new Error('aucune erreur levée')
}

// Qualification minimale pour passer en « à traiter »
const qualification = {
  nature: 'image' as const,
  gravite: 'mineure' as const,
  lieu_correction: 'code' as const,
  attendu: 'Photo nette',
}

describe('création par le widget', () => {
  it('attribue REC-001, REC-002… et note la création dans l’historique', () => {
    const a = creerDepuisWidget(db, signalement)
    const b = creerDepuisWidget(db, signalement)
    expect([a.id, b.id]).toEqual(['REC-001', 'REC-002'])
    expect(a).toMatchObject({
      statut: 'nouvelle',
      signale_par: 'client',
      canal: 'app',
      page: '/a-propos',
      nature: 'image',
    })
    expect(a.historique).toMatchObject([{ auteur: 'client', de: null, vers: 'nouvelle' }])
  })

  it('respecte le préfixe et le premier numéro du projet', () => {
    createProjet(db, { id: 'coress', nom: 'CoReSS', prefixe: 'REC-', premier_numero: 12 })
    expect(creerDepuisWidget(db, { ...signalement, projet: 'coress' }).id).toBe('REC-012')
  })

  it('garde le texte du client mot pour mot', () => {
    const texte = '  « Evry »  -- l’équipe !\n\tdeuxième ligne '
    const c = creerDepuisWidget(db, {
      ...signalement,
      type: 'texte',
      texte_actuel: 'Ancien texte',
      texte_attendu: texte,
      constat: undefined,
    })
    expect(c.texte_attendu).toBe(texte)
    expect(
      signalementSchema.parse({ ...signalement, type: 'texte', texte_attendu: texte }).texte_attendu
    ).toBe(texte)
    expect(c).toMatchObject({ nature: 'texte', texte_actuel: 'Ancien texte' })
    expect(c.constat).not.toBeNull()
    expect(c.attendu).not.toBeNull()
  })

  it('exige le nouveau texte pour un type texte, le constat sinon', () => {
    expect(
      signalementSchema.safeParse({ ...signalement, type: 'texte', constat: 'x' }).success
    ).toBe(false)
    expect(signalementSchema.safeParse({ ...signalement, constat: undefined }).success).toBe(false)
  })

  it('résume le navigateur et ajoute la couleur souhaitée à l’attendu', () => {
    const c = creerDepuisWidget(db, {
      ...signalement,
      type: 'couleur',
      couleur: '#e8590c',
      contexte: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 },
        screen: { width: 390, height: 844 },
        pixelRatio: 3,
        touch: true,
      },
    })
    expect(c).toMatchObject({ navigateur: 'Safari 18 · iOS 18', nature: 'mise_en_page' })
    expect(c.attendu).toContain('#e8590c')
  })

  it('refuse un projet inconnu', () => {
    expect(
      erreurDe(() => creerDepuisWidget(db, { ...signalement, projet: 'inconnu' })).status
    ).toBe(404)
  })
})

describe('statuts et droits (contrat § 4)', () => {
  it('exige la qualification avant « à traiter »', () => {
    const { id } = creerDepuisWidget(db, { ...signalement, type: 'autre' })
    const err = erreurDe(() =>
      mettreAJour(db, id, 'agence', { revision: revision(), statut: 'a_traiter' })
    )
    expect(err.status).toBe(422)
    expect(err.message).toMatch(/nature, gravité, lieu de correction, attendu/)

    const c = mettreAJour(db, id, 'agence', {
      revision: revision(),
      ...qualification,
      statut: 'a_traiter',
    })
    expect(c.statut).toBe('a_traiter')
    expect(c.historique.at(-1)).toMatchObject({
      auteur: 'agence',
      de: 'nouvelle',
      vers: 'a_traiter',
    })
  })

  it("mène une correction jusqu'à « en ligne » côté agent, jamais « validée »", () => {
    const { id } = creerDepuisWidget(db, signalement)
    mettreAJour(db, id, 'agence', { revision: revision(), ...qualification, statut: 'a_traiter' })
    mettreAJour(db, id, 'agent', { revision: revision(), statut: 'en_cours' })

    const sansTraitement = erreurDe(() =>
      mettreAJour(db, id, 'agent', { revision: revision(), statut: 'corrigee' })
    )
    expect(sansTraitement.message).toMatch(/traitement.branche/)

    const corrigee = mettreAJour(db, id, 'agent', {
      revision: revision(),
      statut: 'corrigee',
      traitement: {
        branche: 'retours-kawanah',
        pr: 3,
        commits: ['a1b2c3d'],
        resume: 'Photo remplacée.',
        verification: '375 et 1440 px',
      },
    })
    expect(corrigee.traitement?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    mettreAJour(db, id, 'agent', { revision: revision(), statut: 'en_ligne' })
    expect(
      erreurDe(() => mettreAJour(db, id, 'agent', { revision: revision(), statut: 'validee' }))
        .status
    ).toBe(422)
    expect(mettreAJour(db, id, 'agence', { revision: revision(), statut: 'validee' }).statut).toBe(
      'validee'
    )
  })

  it("interdit à l'agent de toucher aux champs du client ou de l'agence", () => {
    expect(miseAJourAgentSchema.safeParse({ revision: 1, gravite: 'mineure' }).success).toBe(false)
    expect(miseAJourAgentSchema.safeParse({ revision: 1, texte_attendu: 'x' }).success).toBe(false)
  })

  it('exige une question pour « question client » posée par l’agent', () => {
    const { id } = creerDepuisWidget(db, signalement)
    mettreAJour(db, id, 'agence', { revision: revision(), ...qualification, statut: 'a_traiter' })
    expect(
      erreurDe(() =>
        mettreAJour(db, id, 'agent', { revision: revision(), statut: 'question_client' })
      ).message
    ).toMatch(/question/)
    const c = mettreAJour(db, id, 'agent', {
      revision: revision(),
      statut: 'question_client',
      question: 'Quelle photo ?',
    })
    expect(c.question).toBe('Quelle photo ?')
  })

  it('liste les passages possibles par rôle', () => {
    expect(transitionsPossibles('agent', 'nouvelle')).toEqual([])
    expect(transitionsPossibles('agence', 'nouvelle')).toEqual([
      'a_traiter',
      'hors_perimetre',
      'refusee',
      'doublon',
    ])
    expect(transitionsPossibles('agent', 'a_traiter')).toEqual([
      'en_cours',
      'question_client',
      'a_faire_client',
      'corrigee',
    ])
  })

  it('refuse une révision périmée', () => {
    const { id } = creerDepuisWidget(db, signalement)
    const vieille = revision()
    creerDepuisWidget(db, signalement) // un autre signalement arrive entre-temps
    expect(
      erreurDe(() => mettreAJour(db, id, 'agence', { revision: vieille, gravite: 'mineure' }))
        .status
    ).toBe(409)
  })

  it('refuse une nature non active sur le projet', () => {
    const { id } = creerDepuisWidget(db, signalement)
    expect(
      erreurDe(() => mettreAJour(db, id, 'agence', { revision: revision(), nature: 'contenu_cms' }))
        .status
    ).toBe(422)
  })
})

describe('export pour l’agent (contrat § 6)', () => {
  it('suit la forme du contrat et filtre par statut', () => {
    const { id } = creerDepuisWidget(db, signalement)
    creerDepuisWidget(db, signalement)
    mettreAJour(db, id, 'agence', {
      revision: revision(),
      ...qualification,
      lot: 'test-1',
      statut: 'a_traiter',
    })

    const tout = exporterProjet(db, 'kawanah')
    expect(Object.keys(tout)).toEqual(['projet', 'revision', 'mis_a_jour_le', 'corrections'])
    expect(tout.revision).toBe(revision())

    const aTraiter = exporterProjet(db, 'kawanah', { statut: ['a_traiter'], lot: 'test-1' })
    expect(aTraiter.corrections.map((c) => c.id)).toEqual([id])
    expect(Object.keys(aTraiter.corrections[0]!).slice(0, 5)).toEqual([
      'id',
      'projet',
      'date_signalement',
      'signale_par',
      'canal',
    ])
    expect(aTraiter.corrections[0]).not.toHaveProperty('contexte')
  })
})

describe('base', () => {
  it('rouvre une base existante sans erreur ni perte', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'frontnote-')), 'test.db')
    const first = openDatabase(path)
    createProjet(first, { id: 'kawanah', nom: 'Kawanah' })
    creerDepuisWidget(first, signalement)
    first.close()
    const again = openDatabase(path)
    expect(userVersion(again)).toBe(MIGRATIONS.length)
    expect(listCorrections(again, 'kawanah')).toHaveLength(1)
    again.close()
  })
})
