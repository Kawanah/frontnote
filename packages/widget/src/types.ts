// À garder synchronisé avec apps/server/src/lib/vocabulaire.ts (TYPES_CLIENT, APPAREILS)
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

// Écran concerné : valeurs du contrat de corrections, libellés pour le client
export const APPAREILS = ['ordinateur', 'mobile', 'tous'] as const
export type Appareil = (typeof APPAREILS)[number]

export const APPAREIL_LABELS: Record<Appareil, string> = {
  ordinateur: 'Desktop',
  mobile: 'Mobile',
  tous: 'Les deux',
}

const MOBILE_BREAKPOINT = 768

// Présélection : l'écran sur lequel le client consulte le site
export const currentDevice = (): Appareil =>
  window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'ordinateur'

// Ce que le formulaire produit (noms de champs du contrat) ;
// projet, url et contexte sont ajoutés à l'envoi
export interface Draft {
  selecteur: string
  x: number
  y: number
  type: CommentType
  appareil: Appareil
  zone: string
  texte_actuel?: string
  /** Texte du client, jamais retouché (ni trim ni normalisation) */
  texte_attendu?: string
  constat?: string
  attendu?: string
  couleur?: string
  auteur?: string
  _honey?: string
}
