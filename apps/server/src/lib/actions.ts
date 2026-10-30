// Boutons rapides de la liste du dashboard. Ils n'ouvrent que les passages
// permis à l'agence ; l'écriture passe ensuite par mettreAJour (révision, droits,
// champs exigés, historique), comme depuis la fiche.
import { manquantsPour, transitionsPossibles } from './statuts'
import { mettreAJour, type Correction, type MiseAJourAgence } from './corrections'
import { aujourdhui } from './dates'
import type { Db } from './db'
import type { Gravite, Lieu, Nature } from './vocabulaire'

// Gravité proposée selon la nature ; l'agence la change dans la fiche si besoin
const GRAVITE_PAR_NATURE: Partial<Record<Nature, Gravite>> = {
  securite: 'bloquante',
  bug: 'majeure',
  donnees: 'majeure',
  droits_acces: 'majeure',
  accessibilite: 'majeure',
}

// Lieu proposé : le contenu du CMS ne se corrige pas dans le code (contrat § 3)
const LIEU_PAR_NATURE: Partial<Record<Nature, Lieu>> = { contenu_cms: 'cms' }

export type Defauts = Pick<MiseAJourAgence, 'gravite' | 'lieu_correction' | 'lot'>

// Valeurs posées par le passage rapide « À traiter », seulement pour les champs
// vides : rien de ce que l'agence a déjà saisi n'est remplacé
export function qualificationParDefaut(c: Correction, date = aujourdhui()): Defauts {
  const defauts: Defauts = {}
  if (!c.nature) return defauts
  if (!c.gravite) defauts.gravite = GRAVITE_PAR_NATURE[c.nature] ?? 'mineure'
  if (!c.lieu_correction) defauts.lieu_correction = LIEU_PAR_NATURE[c.nature] ?? 'code'
  if (!c.lot) defauts.lot = `retours-${date}`
  return defauts
}

export interface ActionsRapides {
  /**
   * bouton : passage direct (valeurs par défaut comprises) ; attendu : seul
   * l'attendu manque, saisi dans la ligne ; qualifier : lien vers la fiche
   */
  aTraiter: 'bouton' | 'attendu' | 'qualifier' | null
  manquants: string[]
  defauts: Defauts
  refuser: boolean
}

export function actionsRapides(c: Correction): ActionsRapides {
  const possibles = transitionsPossibles('agence', c.statut)
  const versTraiter = c.statut === 'nouvelle' && possibles.includes('a_traiter')
  const defauts = versTraiter ? qualificationParDefaut(c) : {}
  const manquants = versTraiter ? manquantsPour('a_traiter', { ...c, ...defauts }) : []
  const seulAttendu = manquants.length === 1 && !c.attendu
  return {
    aTraiter: versTraiter
      ? manquants.length === 0
        ? 'bouton'
        : seulAttendu
          ? 'attendu'
          : 'qualifier'
      : null,
    manquants,
    defauts,
    refuser: possibles.includes('refusee'),
  }
}

// Passage rapide « À traiter » depuis la liste : valeurs par défaut pour les champs
// vides, attendu saisi dans la ligne s'il manquait
export function passerATraiter(db: Db, c: Correction, revision: number, attendu?: string) {
  return mettreAJour(db, c.id, 'agence', {
    revision,
    ...qualificationParDefaut(c),
    ...(attendu?.trim() && !c.attendu ? { attendu: attendu.trim().slice(0, 2000) } : {}),
    statut: 'a_traiter',
  })
}

// Raisons de refus proposées (texte libre accepté)
export const RAISONS_REFUS = [
  'Essai de l’agence',
  'Hors du périmètre de la mission',
  'Déjà corrigé',
  'Ne sera pas fait',
]
