import { z } from 'zod'
import type { Db } from './db'

export const COMMENT_TYPES = ['texte', 'couleur', 'photo', 'mise-en-page', 'autre'] as const
export const COMMENT_STATUSES = ['ouvert', 'resolu'] as const

export type CommentType = (typeof COMMENT_TYPES)[number]
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

const projectId = z.string().regex(/^[a-z0-9-]{1,50}$/, 'Identifiant de projet invalide')

// Données envoyées par le widget (POST /api/comments)
export const commentInputSchema = z.object({
  projectId,
  url: z.url({ protocol: /^https?$/ }).max(2000),
  selector: z.string().min(1).max(1000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  type: z.enum(COMMENT_TYPES),
  message: z.string().trim().min(1).max(5000),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, 'Couleur attendue au format #rrggbb')
    .optional(),
  author: z.string().trim().max(100).optional(),
  _honey: z.string().optional(), // honeypot anti-robot : doit rester vide
})

export const commentFilterSchema = z.object({
  project: projectId.optional(),
  status: z.enum(COMMENT_STATUSES).optional(),
})

export const statusUpdateSchema = z.object({
  status: z.enum(COMMENT_STATUSES),
})

export type CommentInput = Omit<z.infer<typeof commentInputSchema>, '_honey'>
export type CommentFilter = z.infer<typeof commentFilterSchema>

export interface Comment {
  id: number
  projectId: string
  url: string
  selector: string
  x: number
  y: number
  type: CommentType
  message: string
  color: string | null
  author: string | null
  status: CommentStatus
  createdAt: string
  resolvedAt: string | null
}

const COLUMNS = `
  id, project_id AS projectId, url, selector, x, y, type, message, color, author,
  status, created_at AS createdAt, resolved_at AS resolvedAt
`

export function getComment(db: Db, id: number): Comment | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM comments WHERE id = ?`).get(id)
  return (row as Comment | undefined) ?? null
}

export function createComment(db: Db, input: CommentInput): Comment {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO comments (project_id, url, selector, x, y, type, message, color, author)
       VALUES (@projectId, @url, @selector, @x, @y, @type, @message, @color, @author)`
    )
    .run({ ...input, color: input.color ?? null, author: input.author ?? null })
  return getComment(db, Number(lastInsertRowid)) as Comment
}

export function listComments(db: Db, filter: CommentFilter = {}): Comment[] {
  const where: string[] = []
  if (filter.project) where.push('project_id = @project')
  if (filter.status) where.push('status = @status')
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return db
    .prepare(`SELECT ${COLUMNS} FROM comments ${clause} ORDER BY created_at DESC, id DESC`)
    .all(filter) as Comment[]
}

export function setCommentStatus(db: Db, id: number, status: CommentStatus): Comment | null {
  const { changes } = db
    .prepare(
      `UPDATE comments
       SET status = @status,
           resolved_at = CASE WHEN @status = 'resolu'
             THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE NULL END
       WHERE id = @id`
    )
    .run({ id, status })
  return changes ? getComment(db, id) : null
}
