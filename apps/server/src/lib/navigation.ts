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

// Filtre de la liste ; par défaut, les demandes ouvertes
export function filtreDepuisParams(params: URLSearchParams): Filtre {
  const choixStatut = params.get('statut') ?? ''
  const nature = params.get('nature') as Nature
  const appareil = params.get('appareil') as Appareil
  return {
    statut:
      choixStatut === 'toutes'
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
