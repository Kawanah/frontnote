// Navigation du dashboard : la liste filtrée et la fiche partagent le même filtre,
// passé dans l'adresse, pour aller de demande en demande et revenir à la liste.
import type { Filtre } from './corrections'
import {
  APPAREILS,
  NATURES,
  STATUTS,
  STATUTS_FERMES,
  type Appareil,
  type Nature,
  type Statut,
} from './vocabulaire'

// Paramètres de filtre gardés d'un écran à l'autre
const CLES_FILTRE = ['statut', 'nature', 'appareil', 'lot'] as const

// Onglets de la liste : ce qui attend chacun, dans l'ordre du circuit
export const ONGLETS = [
  { cle: 'qualifier', label: 'À qualifier', statuts: ['nouvelle'] },
  {
    cle: 'en_cours',
    label: 'En cours',
    statuts: ['a_traiter', 'en_cours', 'question_client', 'a_faire_client'],
  },
  { cle: 'verifier', label: 'À vérifier', statuts: ['corrigee', 'en_ligne'] },
  { cle: 'fermees', label: 'Fermées', statuts: STATUTS_FERMES },
] as const satisfies readonly { cle: string; label: string; statuts: readonly Statut[] }[]

export type Onglet = (typeof ONGLETS)[number]['cle']

// Onglet affiché ; par défaut, ce qui attend la qualification
export const ongletDepuisParams = (params: URLSearchParams): Onglet | null => {
  const choix = params.get('statut') ?? ''
  if (!choix) return 'qualifier'
  return ONGLETS.find((o) => o.cle === choix)?.cle ?? null
}

// Filtre de la liste : un onglet, un statut précis (anciens liens) ou « toutes »
export function filtreDepuisParams(params: URLSearchParams): Filtre {
  const choixStatut = params.get('statut') ?? ''
  const nature = params.get('nature') as Nature
  const appareil = params.get('appareil') as Appareil
  const onglet = ONGLETS.find((o) => o.cle === ongletDepuisParams(params))
  return {
    statut: onglet
      ? [...onglet.statuts]
      : choixStatut === 'toutes'
        ? undefined
        : STATUTS.includes(choixStatut as Statut)
          ? [choixStatut as Statut]
          : STATUTS.filter((s) => !STATUTS_FERMES.includes(s)),
    nature: NATURES.includes(nature) ? nature : undefined,
    appareil: APPAREILS.includes(appareil) ? appareil : undefined,
    lot: params.get('lot') || undefined,
  }
}

// « ?statut=…&lot=… » : seulement les paramètres de filtre renseignés, ou ''
export function requeteFiltre(params: URLSearchParams): string {
  const garde = new URLSearchParams()
  for (const cle of CLES_FILTRE) {
    const valeur = params.get(cle)
    if (valeur) garde.set(cle, valeur)
  }
  const texte = garde.toString()
  return texte ? `?${texte}` : ''
}

// Ajoute un paramètre (ex. ok) à une requête qui peut être vide
export const avecParam = (requete: string, param: string) =>
  `${requete}${requete ? '&' : '?'}${param}`

// Demandes voisines dans l'ordre de la liste ; absente de la liste : aucune
export function voisines(
  ids: readonly string[],
  id: string
): { precedente?: string; suivante?: string } {
  const i = ids.indexOf(id)
  if (i === -1) return {}
  return { precedente: ids[i - 1], suivante: ids[i + 1] }
}
