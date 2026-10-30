// Corrections au format du contrat (§ 6) : vue agent, export et archive de clôture
import { listCorrections, type Correction, type Filtre } from './corrections'
import { maintenant } from './dates'
import type { Db } from './db'
import { DomainError } from './errors'
import { getProjet, type Projet } from './projets'

export function versContrat(c: Correction) {
  return {
    id: c.id,
    projet: c.projet,
    date_signalement: c.date_signalement,
    signale_par: c.signale_par,
    canal: c.canal,
    page: c.page,
    etat: c.etat,
    zone: c.zone,
    appareil: c.appareil,
    navigateur: c.navigateur,
    nature: c.nature,
    constat: c.constat,
    attendu: c.attendu,
    texte_actuel: c.texte_actuel,
    texte_attendu: c.texte_attendu,
    source_texte: c.source_texte,
    pieces_jointes: c.pieces_jointes,
    gravite: c.gravite,
    test_lie: c.test_lie,
    ligne_suivi: c.ligne_suivi,
    lieu_correction: c.lieu_correction,
    lot: c.lot,
    statut: c.statut,
    question: c.question,
    signalement: c.signalement,
    note: c.note,
    traitement: c.traitement,
    historique: c.historique,
    // Révision à renvoyer pour écrire cette correction (contrat v3, § 9)
    revision: c.revision,
    // Hors contrat : pour retrouver l'élément exact sur la page
    ancrage: { url: c.url, selecteur: c.selecteur, x: c.x, y: c.y },
    type_client: c.type_client,
    couleur: c.couleur,
  }
}

export function exporterProjet(db: Db, projetId: string, filtre: Filtre = {}) {
  const projet = getProjet(db, projetId)
  if (!projet) throw new DomainError(404, `Projet inconnu : « ${projetId} »`)
  return {
    projet: projet.id,
    revision: projet.revision,
    mis_a_jour_le: projet.mis_a_jour_le,
    corrections: listCorrections(db, projet.id, filtre).map(versContrat),
  }
}

// Archive complète (toutes les corrections, avec leur historique) à garder avant la purge
export function archiverProjet(db: Db, projetId: string) {
  const { corrections, ...entete } = exporterProjet(db, projetId)
  const projet = getProjet(db, projetId) as Projet
  return {
    ...entete,
    nom: projet.nom,
    prefixe: projet.prefixe,
    compteur: projet.compteur,
    archive_le: maintenant(),
    corrections,
  }
}
