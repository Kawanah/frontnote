// Formulaires du dashboard → objets de mise à jour validés ensuite par Zod.
// Le texte du client (texte_attendu) n'est jamais lu depuis un formulaire.

const lire = (form: FormData, cle: string) => {
  const valeur = form.get(cle)
  return typeof valeur === 'string' ? valeur.replace(/\r\n/g, '\n').trim() : undefined
}

// Chaîne vide → null (champ effacé) ; absent → non modifié
const texteOuNull = (valeur: string | undefined) =>
  valeur === undefined ? undefined : valeur || null

export function qualificationDepuisForm(form: FormData): Record<string, unknown> {
  const patch: Record<string, unknown> = { revision: Number(form.get('revision')) }

  for (const cle of ['etat', 'constat', 'attendu', 'test_lie', 'lot', 'note']) {
    const valeur = texteOuNull(lire(form, cle))
    if (valeur !== undefined) patch[cle] = valeur
  }
  for (const cle of ['nature', 'gravite', 'lieu_correction']) {
    const valeur = texteOuNull(lire(form, cle))
    if (valeur !== undefined) patch[cle] = valeur
  }
  for (const cle of ['page', 'zone', 'appareil']) {
    const valeur = lire(form, cle)
    if (valeur) patch[cle] = valeur
  }

  const ligne = lire(form, 'ligne_suivi')
  if (ligne !== undefined) patch.ligne_suivi = ligne ? Number(ligne) : null

  const pieces = lire(form, 'pieces_jointes')
  if (pieces !== undefined) {
    patch.pieces_jointes = pieces
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }

  const lien = lire(form, 'source_lien')
  const luLe = lire(form, 'source_lu_le')
  if (lien !== undefined || luLe !== undefined) {
    patch.source_texte = lien || luLe ? { lien, lu_le: luLe } : null
  }

  const statut = lire(form, 'statut')
  if (statut) patch.statut = statut
  const noteHistorique = lire(form, 'historique_note')
  if (noteHistorique) patch.historique_note = noteHistorique

  return patch
}

// Changement de statut seul ; la raison d'un refus ou d'un doublon va aussi dans « note »
export function statutDepuisForm(form: FormData): Record<string, unknown> {
  const statut = lire(form, 'statut')
  const note = lire(form, 'historique_note')
  const patch: Record<string, unknown> = { revision: Number(form.get('revision')), statut }
  if (note) patch.historique_note = note
  if (note && ['refusee', 'doublon', 'hors_perimetre'].includes(statut ?? '')) patch.note = note
  return patch
}

// Champs repliés dans « Plus de champs » sur la fiche. Une erreur qui en
// cite un (nom technique ou libellé) doit rouvrir le bloc, sinon elle reste cachée.
const CHAMPS_DETAILS =
  /\b(page|appareil|zone|etat|source_texte|source_lien|source_lu_le|pieces_jointes|test_lie|ligne_suivi)\b/

export const erreurSurDetails = (erreur: string) => CHAMPS_DETAILS.test(erreur)
