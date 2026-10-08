// Boutons rapides de la liste du dashboard. Ils n'ouvrent que les passages
// permis à l'agence ; l'écriture passe ensuite par mettreAJour (révision, droits,
// champs exigés, historique), comme depuis la fiche.
import { manquantsPour, transitionsPossibles, type Correction } from './corrections'

export interface ActionsRapides {
  /** bouton : passage direct ; qualifier : il manque des champs, lien vers la fiche */
  aTraiter: 'bouton' | 'qualifier' | null
  manquants: string[]
  refuser: boolean
}

export function actionsRapides(c: Correction): ActionsRapides {
  const possibles = transitionsPossibles('agence', c.statut)
  const versTraiter = c.statut === 'nouvelle' && possibles.includes('a_traiter')
  const manquants = versTraiter ? manquantsPour('a_traiter', c) : []
  return {
    aTraiter: versTraiter ? (manquants.length ? 'qualifier' : 'bouton') : null,
    manquants,
    refuser: possibles.includes('refusee'),
  }
}

// Raisons de refus proposées (texte libre accepté)
export const RAISONS_REFUS = [
  'Essai de l’agence',
  'Hors du périmètre de la mission',
  'Déjà corrigé',
  'Ne sera pas fait',
]
