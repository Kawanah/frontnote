import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  commentInputSchema,
  createComment,
  listComments,
  updateComment,
  type CommentInput,
} from './comments'
import Database from 'better-sqlite3'
import { MIGRATIONS, openDatabase, type Db } from './db'

const base: CommentInput = {
  projectId: 'coress',
  url: 'https://coress.fr/',
  selector: 'header > img.hero',
  x: 0.4,
  y: 0.25,
  type: 'image',
  device: 'desktop',
  message: 'remplacer par photo équipe',
}

let db: Db
beforeEach(() => {
  db = openDatabase(':memory:')
})

describe('commentInputSchema', () => {
  it('accepte un commentaire valide', () => {
    expect(commentInputSchema.safeParse(base).success).toBe(true)
  })

  it.each([
    ['type inconnu', { type: 'police' }],
    ['projet avec majuscules', { projectId: 'CoReSS' }],
    ['url non http', { url: 'javascript:alert(1)' }],
    ['coordonnée hors élément', { x: 1.5 }],
    ['message vide', { message: '   ' }],
    ['couleur mal formée', { type: 'couleur', color: 'rouge' }],
    ['écran inconnu', { device: 'tablette' }],
    ['ancien type photo', { type: 'photo' }],
    ['contexte incomplet', { context: { userAgent: 'x' } }],
  ])('refuse : %s', (_label, patch) => {
    expect(commentInputSchema.safeParse({ ...base, ...patch }).success).toBe(false)
  })
})

describe('migrations', () => {
  const tempPath = () => join(mkdtempSync(join(tmpdir(), 'frontnote-')), 'test.db')

  it('rouvre une base existante sans erreur ni perte', () => {
    const path = tempPath()
    const first = openDatabase(path)
    createComment(first, base)
    first.close()
    const again = openDatabase(path)
    expect(again.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length)
    expect(listComments(again)).toHaveLength(1)
    again.close()
  })

  it('convertit une base v1 (photo, mise-en-page, priorité)', () => {
    const path = tempPath()
    const v1 = new Database(path)
    v1.exec(MIGRATIONS[0]!)
    v1.pragma('user_version = 1')
    const insert = v1.prepare(
      `INSERT INTO comments (project_id, url, selector, x, y, type, priority, message, context)
       VALUES ('coress', 'https://coress.fr/', 'h1', 0, 0, ?, 'bloquant', 'm', ?)`
    )
    insert.run('photo', JSON.stringify({ viewport: { width: 390, height: 844 } }))
    insert.run('mise-en-page', null)
    v1.close()

    const migrated = openDatabase(path)
    const [second, first] = listComments(migrated)
    expect(first).toMatchObject({ type: 'image', device: 'mobile' })
    expect(second).toMatchObject({ type: 'autre', device: 'desktop' })
    expect(first).not.toHaveProperty('priority')
    migrated.close()
  })
})

describe('dépôt commentaires', () => {
  it('crée un commentaire ouvert', () => {
    const c = createComment(db, { ...base, type: 'couleur', color: '#e8590c' })
    expect(c).toMatchObject({ id: 1, projectId: 'coress', status: 'ouvert', color: '#e8590c' })
    expect(c.author).toBeNull()
    expect(c.resolvedAt).toBeNull()
  })

  it('filtre par projet et par statut', () => {
    createComment(db, base)
    createComment(db, { ...base, projectId: 'autre' })
    const { id } = createComment(db, base)
    updateComment(db, id, { status: 'resolu' })

    expect(listComments(db)).toHaveLength(3)
    expect(listComments(db, { project: 'coress' })).toHaveLength(2)
    expect(listComments(db, { project: 'coress', status: 'ouvert' })).toHaveLength(1)
  })

  it('résout puis rouvre un commentaire', () => {
    const { id } = createComment(db, base)
    expect(updateComment(db, id, { status: 'resolu' })?.resolvedAt).not.toBeNull()
    expect(updateComment(db, id, { status: 'ouvert' })?.resolvedAt).toBeNull()
  })

  it('garde le contexte technique', () => {
    const context = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      language: 'fr-FR',
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      pixelRatio: 3,
      touch: true,
    }
    const c = createComment(db, { ...base, type: 'bug', context })
    expect(c.device).toBe('desktop')
    expect(c.context).toEqual(context)
    expect(createComment(db, base).context).toBeNull()
  })

  it('filtre par type et par écran', () => {
    createComment(db, { ...base, type: 'lien', device: 'mobile' })
    createComment(db, base)
    expect(listComments(db, { device: 'mobile' })).toHaveLength(1)
    expect(listComments(db, { type: 'lien' })).toHaveLength(1)
  })

  it('renvoie null pour un id inconnu', () => {
    expect(updateComment(db, 999, { status: 'resolu' })).toBeNull()
  })
})
