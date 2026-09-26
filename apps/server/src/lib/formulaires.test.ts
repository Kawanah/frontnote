import { describe, expect, it } from 'vitest'
import { miseAJourAgenceSchema } from './corrections'
import { qualificationDepuisForm, statutDepuisForm } from './formulaires'

const form = (entries: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.append(k, v)
  return f
}

describe('qualificationDepuisForm', () => {
  it('produit un patch valide, champs vides effacés', () => {
    const patch = qualificationDepuisForm(
      form({
        revision: '4',
        nature: 'texte',
        gravite: 'mineure',
        lieu_correction: 'code',
        lot: '',
        constat: ' Ligne 1\r\nLigne 2 ',
        pieces_jointes: 'https://drive.google.com/a\n\n https://drive.google.com/b ',
        source_lien: 'https://docs.google.com/document/d/x/edit',
        source_lu_le: '2026-09-26',
        ligne_suivi: '23',
        statut: 'a_traiter',
      })
    )
    expect(patch).toMatchObject({
      revision: 4,
      lot: null,
      constat: 'Ligne 1\nLigne 2',
      pieces_jointes: ['https://drive.google.com/a', 'https://drive.google.com/b'],
      source_texte: { lien: 'https://docs.google.com/document/d/x/edit', lu_le: '2026-09-26' },
      ligne_suivi: 23,
      statut: 'a_traiter',
    })
    expect(miseAJourAgenceSchema.safeParse(patch).success).toBe(true)
  })

  it('efface la source quand les deux champs sont vides', () => {
    const patch = qualificationDepuisForm(
      form({ revision: '1', source_lien: '', source_lu_le: '' })
    )
    expect(patch.source_texte).toBeNull()
  })
})

describe('statutDepuisForm', () => {
  it('reporte la raison d’un refus dans la note', () => {
    expect(
      statutDepuisForm(form({ revision: '2', statut: 'refusee', historique_note: 'Déjà traité' }))
    ).toEqual({
      revision: 2,
      statut: 'refusee',
      historique_note: 'Déjà traité',
      note: 'Déjà traité',
    })
  })
})
