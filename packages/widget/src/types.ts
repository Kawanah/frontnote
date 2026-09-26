// À garder synchronisé avec apps/server/src/lib/comments.ts
export const COMMENT_TYPES = ['texte', 'couleur', 'image', 'lien', 'bug', 'autre'] as const
export type CommentType = (typeof COMMENT_TYPES)[number]

export const TYPE_LABELS: Record<CommentType, string> = {
  texte: 'Texte',
  couleur: 'Couleur',
  image: 'Image',
  lien: 'Lien',
  bug: 'Bug',
  autre: 'Autre',
}

// Écran concerné par le retour
export const DEVICES = ['desktop', 'mobile'] as const
export type Device = (typeof DEVICES)[number]

export const DEVICE_LABELS: Record<Device, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
}

// Même seuil que la migration serveur qui déduit l'écran de l'existant
const MOBILE_BREAKPOINT = 768

// Présélection : l'écran sur lequel le client consulte le site
export const currentDevice = (): Device =>
  window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'desktop'

// Ce que le formulaire produit ; projet, URL et contexte sont ajoutés à l'envoi
export interface Draft {
  selector: string
  x: number
  y: number
  type: CommentType
  device: Device
  message: string
  color?: string
  author?: string
  _honey?: string
}
