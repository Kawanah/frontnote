// Règles du circuit des statuts (contrat § 4) : qui pose quoi, depuis quel statut,
// et avec quels champs remplis. Fonctions pures, sans base de données.
import type { Correction } from './corrections'
import type { Statut } from './vocabulaire'

// Statuts que chaque rôle peut poser
const CIBLES: Record<'agence' | 'agent', readonly Statut[]> = {
  agence: [
    'a_traiter',
    'question_client',
    'a_faire_client',
    'validee',
    'hors_perimetre',
    'refusee',
    'doublon',
  ],
  agent: ['en_cours', 'question_client', 'a_faire_client', 'corrigee', 'en_ligne'],
}

// Statuts de départ autorisés pour atteindre chaque statut
const DEPUIS: Record<Statut, readonly Statut[]> = {
  nouvelle: [],
  a_traiter: ['nouvelle', 'question_client', 'a_faire_client', 'corrigee', 'en_ligne'],
  en_cours: ['a_traiter'],
  question_client: ['a_traiter', 'en_cours'],
  a_faire_client: ['a_traiter', 'en_cours'],
  corrigee: ['a_traiter', 'en_cours'],
  en_ligne: ['corrigee'],
  validee: ['en_ligne', 'a_faire_client'],
  hors_perimetre: ['nouvelle', 'a_traiter'],
  refusee: ['nouvelle', 'a_traiter', 'question_client'],
  doublon: ['nouvelle', 'a_traiter'],
}

export const transitionsPossibles = (role: 'agence' | 'agent', de: Statut): Statut[] =>
  CIBLES[role].filter((vers) => DEPUIS[vers].includes(de))

const LIBELLES_CHAMPS: Record<string, string> = {
  nature: 'nature',
  gravite: 'gravité',
  lieu_correction: 'lieu de correction',
  constat: 'constat',
  attendu: 'attendu',
  texte_attendu: 'texte attendu',
  question: 'question',
  note: 'note (raison)',
  'traitement.branche': 'traitement.branche',
  'traitement.resume': 'traitement.resume',
  'traitement.verification': 'traitement.verification',
}

// Champs indispensables avant d'entrer dans un statut
export function champsManquants(vers: Statut, c: Correction, role: 'agence' | 'agent'): string[] {
  const requis: [string, unknown][] = []
  if (vers === 'a_traiter') {
    requis.push(
      ['nature', c.nature],
      ['gravite', c.gravite],
      ['lieu_correction', c.lieu_correction],
      ['constat', c.constat],
      ['attendu', c.attendu]
    )
    if (c.nature === 'texte') requis.push(['texte_attendu', c.texte_attendu])
  }
  if (vers === 'question_client' && role === 'agent') requis.push(['question', c.question])
  if (vers === 'corrigee') {
    requis.push(
      ['traitement.branche', c.traitement?.branche],
      ['traitement.resume', c.traitement?.resume],
      ['traitement.verification', c.traitement?.verification]
    )
  }
  if (vers === 'refusee' || vers === 'doublon') requis.push(['note', c.note])
  return requis
    .filter(([, value]) => value == null || value === '')
    .map(([k]) => LIBELLES_CHAMPS[k] ?? k)
}

// Champs qui manquent pour que l'agence pose ce statut (affichage du dashboard ;
// mettreAJour refait la vérification à l'écriture)
export const manquantsPour = (vers: Statut, c: Correction): string[] =>
  champsManquants(vers, c, 'agence')
