import { beforeEach, describe, expect, it } from 'vitest'
import {
  commentInputSchema,
  createComment,
  listComments,
  setCommentStatus,
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
  ])('refuse : %s', (_label, patch) => {
    expect(commentInputSchema.safeParse({ ...base, ...patch }).success).toBe(false)
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
    setCommentStatus(db, id, 'resolu')

    expect(listComments(db)).toHaveLength(3)
    expect(listComments(db, { project: 'coress' })).toHaveLength(2)
    expect(listComments(db, { project: 'coress', status: 'ouvert' })).toHaveLength(1)
  })

  it('résout puis rouvre un commentaire', () => {
    const { id } = createComment(db, base)
    expect(setCommentStatus(db, id, 'resolu')?.resolvedAt).not.toBeNull()
    expect(setCommentStatus(db, id, 'ouvert')?.resolvedAt).toBeNull()
  })

  it('renvoie null pour un id inconnu', () => {
    expect(setCommentStatus(db, 999, 'resolu')).toBeNull()
  })
})
