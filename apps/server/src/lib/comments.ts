import { z } from 'zod'
import type { Db } from './db'

// Listes à garder synchronisées avec packages/widget/src/types.ts
export const COMMENT_TYPES = ['texte', 'couleur', 'image', 'lien', 'bug', 'autre'] as const
export const DEVICES = ['desktop', 'mobile'] as const
export const COMMENT_STATUSES = ['ouvert', 'resolu'] as const

export type CommentType = (typeof COMMENT_TYPES)[number]
export type Device = (typeof DEVICES)[number]
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

const projectId = z.string().regex(/^[a-z0-9-]{1,50}$/, 'Identifiant de projet invalide')
const size = z.object({
  width: z.number().int().min(0).max(20_000),
  height: z.number().int().min(0).max(20_000),
})

// Contexte technique relevé automatiquement par le widget
export const contextSchema = z.object({
  userAgent: z.string().max(500),
  language: z.string().max(35).optional(),
  viewport: size,
  screen: size,
  pixelRatio: z.number().min(0).max(10),
  touch: z.boolean(),
})

// Données envoyées par le widget (POST /api/comments)
export const commentInputSchema = z.object({
  projectId,
  url: z.url({ protocol: /^https?$/ }).max(2000),
  selector: z.string().min(1).max(1000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  type: z.enum(COMMENT_TYPES),
  device: z.enum(DEVICES),
  message: z.string().trim().min(1).max(5000),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, 'Couleur attendue au format #rrggbb')
    .optional(),
  author: z.string().trim().max(100).optional(),
  context: contextSchema.optional(),
  _honey: z.string().optional(), // honeypot anti-robot : doit rester vide
})

export const commentFilterSchema = z.object({
  project: projectId.optional(),
  status: z.enum(COMMENT_STATUSES).optional(),
  type: z.enum(COMMENT_TYPES).optional(),
  device: z.enum(DEVICES).optional(),
})

// Modification depuis le dashboard (PATCH /api/comments/:id)
export const commentUpdateSchema = z.object({
  status: z.enum(COMMENT_STATUSES),
})

export type CommentContext = z.infer<typeof contextSchema>
export type CommentInput = Omit<z.input<typeof commentInputSchema>, '_honey'>
export type CommentFilter = z.infer<typeof commentFilterSchema>
export type CommentUpdate = z.infer<typeof commentUpdateSchema>

export interface Comment {
  id: number
  projectId: string
  url: string
  selector: string
  x: number
  y: number
  type: CommentType
  device: Device
  message: string
  color: string | null
  author: string | null
  context: CommentContext | null
  status: CommentStatus
  createdAt: string
  resolvedAt: string | null
}

const COLUMNS = `
  id, project_id AS projectId, url, selector, x, y, type, device, message, color,
  author, context, status, created_at AS createdAt, resolved_at AS resolvedAt
`

type Row = Omit<Comment, 'context'> & { context: string | null }

const toComment = (row: Row): Comment => ({
  ...row,
  context: row.context ? (JSON.parse(row.context) as CommentContext) : null,
})

export function getComment(db: Db, id: number): Comment | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM comments WHERE id = ?`).get(id) as Row | undefined
  return row ? toComment(row) : null
}

export function createComment(db: Db, input: CommentInput): Comment {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO comments
         (project_id, url, selector, x, y, type, device, message, color, author, context)
       VALUES
         (@projectId, @url, @selector, @x, @y, @type, @device, @message, @color, @author, @context)`
    )
    .run({
      ...input,
      color: input.color ?? null,
      author: input.author ?? null,
      context: input.context ? JSON.stringify(input.context) : null,
    })
  return getComment(db, Number(lastInsertRowid)) as Comment
}

export function listComments(db: Db, filter: CommentFilter = {}): Comment[] {
  const where = (['project', 'status', 'type', 'device'] as const)
    .filter((key) => filter[key])
    .map((key) => `${key === 'project' ? 'project_id' : key} = @${key}`)
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM comments ${clause} ORDER BY created_at DESC, id DESC`)
    .all(filter) as Row[]
  return rows.map(toComment)
}

export function updateComment(db: Db, id: number, { status }: CommentUpdate): Comment | null {
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
