// À garder synchronisé avec apps/server/src/lib/comments.ts
export const COMMENT_TYPES = ['texte', 'couleur', 'photo', 'mise-en-page', 'autre'] as const
export type CommentType = (typeof COMMENT_TYPES)[number]

export const TYPE_LABELS: Record<CommentType, string> = {
  texte: 'Texte',
  couleur: 'Couleur',
  photo: 'Photo',
  'mise-en-page': 'Mise en page',
  autre: 'Autre',
}

// Ce que le formulaire produit ; le projet et l'URL sont ajoutés à l'envoi
export interface Draft {
  selector: string
  x: number
  y: number
  type: CommentType
  message: string
  color?: string
  author?: string
  _honey?: string
}
