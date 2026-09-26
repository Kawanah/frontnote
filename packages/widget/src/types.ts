// À garder synchronisé avec apps/server/src/lib/comments.ts
export const COMMENT_TYPES = ['texte', 'couleur', 'photo', 'mise-en-page', 'bug', 'autre'] as const
export type CommentType = (typeof COMMENT_TYPES)[number]

export const TYPE_LABELS: Record<CommentType, string> = {
  texte: 'Texte',
  couleur: 'Couleur',
  photo: 'Photo',
  'mise-en-page': 'Mise en page',
  bug: 'Bug',
  autre: 'Autre',
}

export const PRIORITIES = ['bloquant', 'a-corriger', 'suggestion'] as const
export type Priority = (typeof PRIORITIES)[number]
export const DEFAULT_PRIORITY: Priority = 'a-corriger'

export const PRIORITY_LABELS: Record<Priority, string> = {
  bloquant: 'Bloquant',
  'a-corriger': 'À corriger',
  suggestion: 'Suggestion',
}

// Ce que le formulaire produit ; projet, URL et contexte sont ajoutés à l'envoi
export interface Draft {
  selector: string
  x: number
  y: number
  type: CommentType
  priority: Priority
  message: string
  color?: string
  author?: string
  _honey?: string
}
