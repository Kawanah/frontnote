import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { transitionsPossibles } from './statuts'
import { archiverProjet, exporterProjet } from './exportAgent'
import {
  creerDepuisWidget,
  creerLotDepuisWidget,
  LOT_MAX,
  listCorrections,
  lotSchema,
  mettreAJour,
  miseAJourAgentSchema,
  signalementSchema,
  type Signalement,
} from './corrections'
import { MIGRATIONS, openDatabase, userVersion, type Db } from './db'
import { DomainError } from './errors'
import {
  clore,
  createProjet,
  getProjet,
  regenererCle,
  rouvrirProjet,
  setJetonAgent,
} from './projets'

const CLE = 'cle-de-test'
const signalement: Omit<Signalement, '_honey'> = {
  projet: 'kawanah',
  cle: CLE,
  url: 'https://kawanah.fr/a-propos?frontnote=kawanah',
  selecteur: 'main > p:nth-of-type(2)',
  x: 0.4,
  y: 0.5,
  type: 'image',
  appareil: 'mobile',
  zone: 'paragraphe « Notre équipe »',
  constat: 'La photo est floue',
}

// Projet de test avec une clé d'activation connue
function creerProjet(base: Db, input: Parameters<typeof createProjet>[1]) {
  createProjet(base, input)
  base.prepare('UPDATE projets SET cle_activation = ? WHERE id = ?').run(CLE, input.id)
}

let db: Db
beforeEach(() => {
  db = openDatabase(':memory:')
  creerProjet(db, { id: 'kawanah', nom: 'Kawanah Studio' })
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
    creerProjet(db, { id: 'coress', nom: 'CoReSS', prefixe: 'CRS-', premier_numero: 12 })
    expect(creerDepuisWidget(db, { ...signalement, projet: 'coress' }).id).toBe('CRS-012')
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

describe('lot validé par le client', () => {
  const { projet: _p, cle: _c, ...retour } = signalement
  const lot = (corrections: (typeof retour)[]) => ({ projet: 'kawanah', cle: CLE, corrections })

  it('crée tout le lot, identifiants dans l’ordre, une seule révision', () => {
    const avant = revision()
    const ids = creerLotDepuisWidget(
      db,
      lot([
        retour,
        { ...retour, type: 'texte', texte_attendu: ' Mot pour mot ', constat: undefined },
      ])
    )
    expect(ids).toEqual(['REC-001', 'REC-002'])
    expect(revision()).toBe(avant + 1)
    expect(listCorrections(db, 'kawanah').map((c) => c.texte_attendu)).toContain(' Mot pour mot ')
  })

  it('tout ou rien : clé refusée (403) ou projet clos (410), rien n’est créé', () => {
    expect(erreurDe(() => creerLotDepuisWidget(db, { ...lot([retour]), cle: 'faux' })).status).toBe(
      403
    )
    clore(db, 'kawanah')
    expect(erreurDe(() => creerLotDepuisWidget(db, lot([retour]))).status).toBe(410)
    expect(getProjet(db, 'kawanah')!.compteur).toBe(0)
  })

  it('valide chaque retour et limite la taille du lot', () => {
    expect(lotSchema.safeParse(lot([retour])).success).toBe(true)
    expect(lotSchema.safeParse(lot([])).success).toBe(false)
    expect(lotSchema.safeParse(lot([{ ...retour, constat: undefined }])).success).toBe(false)
    expect(lotSchema.safeParse(lot(Array(LOT_MAX + 1).fill(retour))).success).toBe(false)
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

  it('refuse une révision périmée : la correction a été écrite depuis la lecture', () => {
    const { id } = creerDepuisWidget(db, signalement)
    const lue = revision()
    mettreAJour(db, id, 'agence', { revision: lue, gravite: 'majeure' })
    expect(
      erreurDe(() => mettreAJour(db, id, 'agence', { revision: lue, gravite: 'mineure' })).status
    ).toBe(409)
  })

  it('une autre écriture du projet ne bloque pas (révision par correction)', () => {
    const { id } = creerDepuisWidget(db, signalement)
    const autre = creerDepuisWidget(db, signalement)
    const lue = revision()
    creerDepuisWidget(db, signalement) // un retour du client arrive entre-temps
    mettreAJour(db, autre.id, 'agence', { revision: lue, gravite: 'majeure' })
    expect(mettreAJour(db, id, 'agence', { revision: lue, gravite: 'mineure' }).gravite).toBe(
      'mineure'
    )
  })

  it('accepte la révision de la correction et renvoie la suivante', () => {
    const c = creerDepuisWidget(db, signalement)
    creerDepuisWidget(db, signalement)
    expect(c.revision).toBeLessThan(revision())
    const apres = mettreAJour(db, c.id, 'agence', { revision: c.revision, gravite: 'majeure' })
    expect(apres.revision).toBe(revision())
    expect(
      mettreAJour(db, c.id, 'agence', { revision: apres.revision, gravite: 'mineure' }).gravite
    ).toBe('mineure')
  })

  it('refuse une révision venue du futur', () => {
    const { id } = creerDepuisWidget(db, signalement)
    expect(
      erreurDe(() =>
        mettreAJour(db, id, 'agence', { revision: revision() + 1, gravite: 'mineure' })
      ).status
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
    creerProjet(first, { id: 'kawanah', nom: 'Kawanah' })
    creerDepuisWidget(first, signalement)
    first.close()
    const again = openDatabase(path)
    expect(userVersion(again)).toBe(MIGRATIONS.length)
    expect(listCorrections(again, 'kawanah')).toHaveLength(1)
    again.close()
  })
})

describe('identifiants entre projets (incident du 2026-09-27)', () => {
  it('refuse un second projet avec le même préfixe (409)', () => {
    const err = erreurDe(() => createProjet(db, { id: 'coress', nom: 'CoReSS', prefixe: 'REC-' }))
    expect(err.status).toBe(409)
    expect(err.message).toContain('« kawanah »')
    expect(getProjet(db, 'coress')).toBeNull()
  })

  it('migration 2 : kawanah passe en KAW- avec son historique, coress garde REC-', () => {
    // État de la production : deux projets en REC-, base en version 1
    const path = join(mkdtempSync(join(tmpdir(), 'frontnote-')), 'prod.db')
    const v1 = new DatabaseSync(path)
    v1.exec(MIGRATIONS[0]!)
    v1.exec('PRAGMA user_version = 1')
    const projet = v1.prepare(
      `INSERT INTO projets (id, nom, prefixe, compteur, natures, mis_a_jour_le, cree_le)
       VALUES (?, ?, 'REC-', ?, '["image"]', '2026-09-26', '2026-09-26')`
    )
    projet.run('kawanah', 'Kawanah', 1)
    projet.run('coress', 'CoReSS', 11)
    v1.prepare(
      `INSERT INTO corrections (id, projet, date_signalement, signale_par, canal, page, zone,
         appareil, cree_le, mis_a_jour_le)
       VALUES ('REC-001', 'kawanah', '2026-09-27', 'client', 'app', '/', 'titre', 'tous', 'x', 'x')`
    ).run()
    v1.prepare(
      `INSERT INTO historique (correction_id, date, auteur, vers) VALUES ('REC-001', 'x', 'client', 'nouvelle')`
    ).run()
    v1.close()

    const migree = openDatabase(path)
    migree.prepare('UPDATE projets SET cle_activation = ?').run(CLE)
    expect(userVersion(migree)).toBe(MIGRATIONS.length)
    expect(getProjet(migree, 'kawanah')).toMatchObject({
      prefixe: 'KAW-',
      compteur: 1,
      revision: 1,
    })
    expect(getProjet(migree, 'coress')).toMatchObject({ prefixe: 'REC-', compteur: 11 })
    const [renommee] = listCorrections(migree, 'kawanah')
    expect(renommee).toMatchObject({ id: 'KAW-001' })
    expect(renommee!.historique).toHaveLength(1)

    // Plus de collision : chaque projet suit sa numérotation
    expect(creerDepuisWidget(migree, signalement).id).toBe('KAW-002')
    expect(creerDepuisWidget(migree, { ...signalement, projet: 'coress' }).id).toBe('REC-012')
    expect(() =>
      migree.prepare("UPDATE projets SET prefixe = 'REC-' WHERE id = 'kawanah'").run()
    ).toThrow(/UNIQUE/)
    migree.close()
  })

  it('identifiant déjà pris : 409 lisible au lieu d’une erreur interne, compteur intact', () => {
    creerDepuisWidget(db, signalement)
    db.prepare("UPDATE projets SET compteur = 0 WHERE id = 'kawanah'").run()
    const err = erreurDe(() => creerDepuisWidget(db, signalement))
    expect(err.status).toBe(409)
    expect(err.message).toContain('REC-001')
    expect(getProjet(db, 'kawanah')!.compteur).toBe(0)
  })
})

describe('clôture d’un projet', () => {
  it('archive tout, purge ce projet seulement, refuse le widget, ne réutilise aucun numéro', () => {
    creerProjet(db, { id: 'coress', nom: 'CoReSS', prefixe: 'CRS-' })
    const gardee = creerDepuisWidget(db, { ...signalement, projet: 'coress' })
    creerDepuisWidget(db, signalement)
    creerDepuisWidget(db, signalement)
    setJetonAgent(db, 'kawanah', 'empreinte')

    const archive = archiverProjet(db, 'kawanah')
    expect(archive).toMatchObject({ projet: 'kawanah', prefixe: 'REC-', compteur: 2 })
    expect(archive.corrections.map((c) => c.id)).toEqual(['REC-002', 'REC-001'])
    expect(archive.corrections[0]!.historique).toHaveLength(1)

    expect(clore(db, 'kawanah')).toBe(2)
    expect(listCorrections(db, 'kawanah')).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM historique').get()).toEqual({ n: 1 })
    expect(listCorrections(db, 'coress').map((c) => c.id)).toEqual([gardee.id])
    const close = getProjet(db, 'kawanah')!
    expect(close.clos_le).not.toBeNull()
    expect(close.jeton_agent).toBeNull()
    expect(erreurDe(() => creerDepuisWidget(db, signalement)).status).toBe(410)

    rouvrirProjet(db, 'kawanah')
    expect(creerDepuisWidget(db, signalement).id).toBe('REC-003')
  })
})

describe('clé d’activation du widget', () => {
  it('chaque projet reçoit sa propre clé aléatoire', () => {
    createProjet(db, { id: 'coress', nom: 'CoReSS', prefixe: 'CRS-' })
    const cle = getProjet(db, 'coress')!.cle_activation
    expect(cle).toMatch(/^[0-9a-f]{24}$/)
    expect(cle).not.toBe(CLE)
  })

  it('refuse un envoi sans la bonne clé (403), y compris l’ancien lien ?frontnote=<projet>', () => {
    for (const cle of ['mauvaise', 'kawanah']) {
      expect(erreurDe(() => creerDepuisWidget(db, { ...signalement, cle })).status).toBe(403)
    }
    expect(getProjet(db, 'kawanah')!.compteur).toBe(0)
  })

  it('régénérer la clé coupe les anciens liens', () => {
    const nouvelle = regenererCle(db, 'kawanah')
    expect(erreurDe(() => creerDepuisWidget(db, signalement)).status).toBe(403)
    expect(creerDepuisWidget(db, { ...signalement, cle: nouvelle }).id).toBe('REC-001')
  })

  it('migration 4 : une clé pour chaque projet existant', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'frontnote-')), 'v3.db')
    const v3 = new DatabaseSync(path)
    MIGRATIONS.slice(0, 3).forEach((sql) => v3.exec(sql))
    v3.exec('PRAGMA user_version = 3')
    v3.prepare(
      `INSERT INTO projets (id, nom, natures, mis_a_jour_le, cree_le) VALUES ('a', 'A', '[]', 'x', 'x')`
    ).run()
    v3.close()
    const migree = openDatabase(path)
    expect(getProjet(migree, 'a')!.cle_activation).toMatch(/^[0-9a-f]{24}$/)
    migree.close()
  })

  it('migration 6 : les corrections existantes prennent la révision de leur projet', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'frontnote-')), 'v5.db')
    const v5 = openDatabase(path)
    creerProjet(v5, { id: 'kawanah', nom: 'Kawanah Studio' })
    const { id } = creerDepuisWidget(v5, signalement)
    creerDepuisWidget(v5, signalement)
    v5.exec('ALTER TABLE corrections DROP COLUMN revision; PRAGMA user_version = 5')
    v5.close()
    const migree = openDatabase(path)
    const projet = getProjet(migree, 'kawanah')!
    expect(listCorrections(migree, 'kawanah').map((c) => c.revision)).toEqual([
      projet.revision,
      projet.revision,
    ])
    // Une révision lue avant la mise en ligne reste acceptée
    expect(
      mettreAJour(migree, id, 'agence', { revision: projet.revision, gravite: 'mineure' }).gravite
    ).toBe('mineure')
    migree.close()
  })
})
