import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routePublique, sessionRequise } from './acces'
import { valeurSession } from './auth'
import { creerDepuisWidget, listCorrections } from './corrections'
import { openDatabase, type Db } from './db'
import { createProjet, listProjets } from './projets'
import { sauvegarder } from './sauvegarde'

const CLE = 'cle-de-test'
let dossier: string
let db: Db

function retour(constat: string) {
  return creerDepuisWidget(db, {
    projet: 'kawanah',
    cle: CLE,
    url: 'https://kawanah.fr/',
    selecteur: 'h1',
    x: 0.5,
    y: 0.5,
    type: 'bug',
    appareil: 'mobile',
    zone: 'titre',
    constat,
  })
}

// Écrit la copie sur disque et l'ouvre comme une vraie base
function ouvrirCopie(octets: Uint8Array): Db {
  const chemin = join(dossier, `copie-${Math.random().toString(36).slice(2)}.db`)
  writeFileSync(chemin, octets)
  return openDatabase(chemin)
}

beforeEach(() => {
  dossier = mkdtempSync(join(tmpdir(), 'frontnote-test-'))
  // Base sur disque : le mode WAL n'existe pas pour :memory:
  db = openDatabase(join(dossier, 'frontnote.db'))
  createProjet(db, { id: 'kawanah', nom: 'Kawanah Studio', prefixe: 'KAW-' })
  db.prepare('UPDATE projets SET cle_activation = ? WHERE id = ?').run(CLE, 'kawanah')
})

afterEach(() => {
  db.close()
  rmSync(dossier, { recursive: true, force: true })
})

describe('sauvegarde de la base', () => {
  it('produit une base qui s’ouvre et contient les mêmes données', () => {
    retour('Titre coupé')
    const copie = ouvrirCopie(sauvegarder(db, dossier))
    expect(listProjets(copie)).toEqual(listProjets(db))
    expect(listCorrections(copie, 'kawanah')).toEqual(listCorrections(db, 'kawanah'))
    copie.close()
  })

  it('inclut les écritures encore dans le journal WAL', () => {
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
    db.exec('PRAGMA wal_autocheckpoint = 0') // rien n'est fusionné dans le .db
    retour('Écrit juste avant la sauvegarde')
    expect(readdirSync(dossier)).toContain('frontnote.db-wal')

    const copie = ouvrirCopie(sauvegarder(db, dossier))
    expect(listCorrections(copie, 'kawanah').map((c) => c.constat)).toEqual([
      'Écrit juste avant la sauvegarde',
    ])
    copie.close()
  })

  it('supprime le fichier temporaire, même en cas d’erreur', () => {
    const temporaires = () =>
      readdirSync(dossier).filter((f) => f.startsWith('frontnote-sauvegarde-'))
    sauvegarder(db, dossier)
    expect(temporaires()).toEqual([])

    db.close()
    expect(() => sauvegarder(db, dossier)).toThrow()
    expect(temporaires()).toEqual([])
    db = openDatabase(join(dossier, 'frontnote.db'))
  })
})

describe('accès à la sauvegarde', () => {
  const TOKEN = 'jeton-agence-de-test'

  it('sans session, /sauvegarde.db renvoie vers /connexion', () => {
    expect(routePublique('/sauvegarde.db')).toBe(false)
    expect(sessionRequise('/sauvegarde.db', undefined, TOKEN)).toBe(true)
    // Un jeton agent (ou n'importe quelle autre valeur) ne remplace pas la session
    expect(sessionRequise('/sauvegarde.db', 'jeton-agent', TOKEN)).toBe(true)
    expect(sessionRequise('/sauvegarde.db', valeurSession(TOKEN), TOKEN)).toBe(false)
  })
})
