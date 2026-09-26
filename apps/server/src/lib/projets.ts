import { z } from 'zod'
import { maintenant } from './dates'
import type { Db } from './db'
import { DomainError } from './errors'
import { NATURES, NATURES_COMMUNES, STATUTS_FERMES, type Nature } from './vocabulaire'

export const projetIdSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,50}$/, 'Identifiant : minuscules, chiffres et tirets')

export const nouveauProjetSchema = z.object({
  id: projetIdSchema,
  nom: z.string().trim().min(1).max(100),
  prefixe: z
    .string()
    .regex(/^[A-Z][A-Z0-9]{0,9}-$/, 'Préfixe attendu du type REC-')
    .default('REC-'),
  // Premier numéro attribué : 12 si REC-001 à REC-011 existent déjà ailleurs
  premier_numero: z.coerce.number().int().min(1).max(99_999).default(1),
})

export const reglagesProjetSchema = z.object({
  nom: z.string().trim().min(1).max(100),
  natures: z.array(z.enum(NATURES)).min(1, 'Au moins une nature active'),
})

export interface Projet {
  id: string
  nom: string
  prefixe: string
  compteur: number
  natures: Nature[]
  jeton_agent: string | null
  revision: number
  mis_a_jour_le: string
  cree_le: string
}

export interface ResumeProjet extends Projet {
  total: number
  ouvertes: number
  nouvelles: number
}

type Row = Omit<Projet, 'natures'> & { natures: string }
const fromRow = (row: Row): Projet => ({ ...row, natures: JSON.parse(row.natures) as Nature[] })

export function getProjet(db: Db, id: string): Projet | null {
  const row = db.prepare('SELECT * FROM projets WHERE id = ?').get(id) as Row | undefined
  return row ? fromRow(row) : null
}

export function createProjet(db: Db, input: z.input<typeof nouveauProjetSchema>): Projet {
  const { id, nom, prefixe, premier_numero } = nouveauProjetSchema.parse(input)
  if (getProjet(db, id)) throw new DomainError(409, `Le projet « ${id} » existe déjà`)
  const now = maintenant()
  db.prepare(
    `INSERT INTO projets (id, nom, prefixe, compteur, natures, mis_a_jour_le, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, nom, prefixe, premier_numero - 1, JSON.stringify(NATURES_COMMUNES), now, now)
  return getProjet(db, id) as Projet
}

export function listProjets(db: Db): ResumeProjet[] {
  const fermes = STATUTS_FERMES.map((s) => `'${s}'`).join(', ')
  const rows = db
    .prepare(
      `SELECT p.*,
         COUNT(c.id) AS total,
         COUNT(CASE WHEN c.statut NOT IN (${fermes}) THEN 1 END) AS ouvertes,
         COUNT(CASE WHEN c.statut = 'nouvelle' THEN 1 END) AS nouvelles
       FROM projets p LEFT JOIN corrections c ON c.projet = p.id
       GROUP BY p.id ORDER BY p.nom`
    )
    .all() as (Row & { total: number; ouvertes: number; nouvelles: number })[]
  return rows.map((row) => ({
    ...fromRow(row),
    total: row.total,
    ouvertes: row.ouvertes,
    nouvelles: row.nouvelles,
  }))
}

export function updateReglages(db: Db, id: string, input: z.input<typeof reglagesProjetSchema>) {
  const { nom, natures } = reglagesProjetSchema.parse(input)
  db.prepare('UPDATE projets SET nom = ?, natures = ? WHERE id = ?').run(
    nom,
    JSON.stringify(natures),
    id
  )
}

export function setJetonAgent(db: Db, id: string, empreinte: string) {
  db.prepare('UPDATE projets SET jeton_agent = ? WHERE id = ?').run(empreinte, id)
}

// À appeler à chaque écriture d'une correction (contrat § 6 : revision)
export function bumpRevision(db: Db, id: string): number {
  const row = db
    .prepare(
      'UPDATE projets SET revision = revision + 1, mis_a_jour_le = ? WHERE id = ? RETURNING revision'
    )
    .get(maintenant(), id) as { revision: number }
  return row.revision
}

// Identifiant suivant (REC-012) ; le compteur ne recule jamais (contrat § 7.4)
export function nextId(db: Db, id: string): string {
  const row = db
    .prepare('UPDATE projets SET compteur = compteur + 1 WHERE id = ? RETURNING compteur, prefixe')
    .get(id) as { compteur: number; prefixe: string }
  return `${row.prefixe}${String(row.compteur).padStart(3, '0')}`
}
