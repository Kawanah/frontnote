// Vocabulaire du contrat de corrections (Contrat-corrections-agents.md, v2).
// Les valeurs sont celles du contrat ; les libellés servent au dashboard.

export const STATUTS = [
  'nouvelle',
  'a_traiter',
  'en_cours',
  'question_client',
  'a_faire_client',
  'corrigee',
  'en_ligne',
  'validee',
  'hors_perimetre',
  'refusee',
  'doublon',
] as const
export type Statut = (typeof STATUTS)[number]

export const STATUT_LABELS: Record<Statut, string> = {
  nouvelle: 'Nouvelle',
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  question_client: 'Question client',
  a_faire_client: 'À faire (client)',
  corrigee: 'Corrigée',
  en_ligne: 'En ligne',
  validee: 'Validée',
  hors_perimetre: 'Hors périmètre',
  refusee: 'Refusée',
  doublon: 'Doublon',
}

export const STATUTS_FERMES: readonly Statut[] = ['validee', 'hors_perimetre', 'refusee', 'doublon']

export const NATURES = [
  'texte',
  'contenu_cms',
  'image',
  'mise_en_page',
  'bug',
  'accessibilite',
  'legal',
  'donnees',
  'performance',
  'securite',
  'droits_acces',
  'evolution',
] as const
export type Nature = (typeof NATURES)[number]

export const NATURE_LABELS: Record<Nature, string> = {
  texte: 'Texte',
  contenu_cms: 'Contenu CMS',
  image: 'Image',
  mise_en_page: 'Mise en page',
  bug: 'Bug',
  accessibilite: 'Accessibilité',
  legal: 'Légal',
  donnees: 'Données',
  performance: 'Performance',
  securite: 'Sécurité',
  droits_acces: "Droits d'accès",
  evolution: 'Évolution',
}

// Natures actives par défaut (tronc commun, § 10)
export const NATURES_COMMUNES: readonly Nature[] = [
  'texte',
  'image',
  'mise_en_page',
  'bug',
  'accessibilite',
  'evolution',
  'performance',
  'securite',
]

export const GRAVITES = ['bloquante', 'majeure', 'mineure', 'cosmetique'] as const
export type Gravite = (typeof GRAVITES)[number]
export const GRAVITE_LABELS: Record<Gravite, string> = {
  bloquante: 'Bloquante',
  majeure: 'Majeure',
  mineure: 'Mineure',
  cosmetique: 'Cosmétique',
}

export const APPAREILS = ['tous', 'ordinateur', 'mobile', 'tablette'] as const
export type Appareil = (typeof APPAREILS)[number]
export const APPAREIL_LABELS: Record<Appareil, string> = {
  tous: 'Tous',
  ordinateur: 'Ordinateur',
  mobile: 'Mobile',
  tablette: 'Tablette',
}

export const LIEUX = ['code', 'cms', 'document_client', 'hebergement', 'hors_site'] as const
export type Lieu = (typeof LIEUX)[number]
export const LIEU_LABELS: Record<Lieu, string> = {
  code: 'Code',
  cms: 'CMS',
  document_client: 'Document client',
  hebergement: 'Hébergement',
  hors_site: 'Hors site',
}

export const SIGNALE_PAR = ['client', 'agence', 'recette'] as const
export const CANAUX = ['app', 'mail', 'reunion', 'telephone', 'recette', 'tableau'] as const

// Types proposés au client dans le widget (vocabulaire simple)
export const TYPES_CLIENT = ['texte', 'couleur', 'image', 'lien', 'bug', 'autre'] as const
export type TypeClient = (typeof TYPES_CLIENT)[number]

// Nature proposée d'après le choix du client ; l'agence confirme à la qualification
export const NATURE_PAR_TYPE: Record<TypeClient, Nature | null> = {
  texte: 'texte',
  couleur: 'mise_en_page',
  image: 'image',
  lien: 'bug',
  bug: 'bug',
  autre: null,
}

export type Role = 'client' | 'agence' | 'agent'
