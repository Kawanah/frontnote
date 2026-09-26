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
import { openDatabase, type Db } from './db'

const base: CommentInput = {
  projectId: 'coress',
  url: 'https://coress.fr/',
  selector: 'header > img.hero',
  x: 0.4,
  y: 0.25,
  type: 'photo',
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
    ['priorité inconnue', { priority: 'urgent' }],
    ['contexte incomplet', { context: { userAgent: 'x' } }],
  ])('refuse : %s', (_label, patch) => {
    expect(commentInputSchema.safeParse({ ...base, ...patch }).success).toBe(false)
  })
})

describe('migrations', () => {
  it('rouvre une base existante sans erreur ni perte', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'frontnote-')), 'test.db')
    const first = openDatabase(path)
    createComment(first, base)
    first.close()
    const again = openDatabase(path)
    expect(again.pragma('user_version', { simple: true })).toBe(1)
    expect(listComments(again)).toHaveLength(1)
    again.close()
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

  it('applique la priorité par défaut et garde le contexte technique', () => {
    const context = {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      language: 'fr-FR',
      viewport: { width: 390, height: 844 },
      screen: { width: 390, height: 844 },
      pixelRatio: 3,
      touch: true,
    }
    const c = createComment(db, { ...base, type: 'bug', context })
    expect(c.priority).toBe('a-corriger')
    expect(c.context).toEqual(context)
    expect(createComment(db, base).context).toBeNull()
  })

  it('filtre par type et priorité', () => {
    createComment(db, { ...base, type: 'bug', priority: 'bloquant' })
    createComment(db, { ...base, priority: 'suggestion' })
    expect(listComments(db, { priority: 'bloquant' })).toHaveLength(1)
    expect(listComments(db, { type: 'bug' })).toHaveLength(1)
  })

  it('change la priorité sans toucher au statut', () => {
    const { id } = createComment(db, { ...base, priority: 'bloquant' })
    const c = updateComment(db, id, { priority: 'suggestion' })
    expect(c).toMatchObject({ priority: 'suggestion', status: 'ouvert' })
  })

  it('renvoie null pour un id inconnu', () => {
    expect(updateComment(db, 999, { status: 'resolu' })).toBeNull()
  })
})
