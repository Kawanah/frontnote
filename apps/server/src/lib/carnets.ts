// Carnets du widget : copie, côté serveur, des retours que le client prépare
// (brouillons) et de ceux qu'il a déjà envoyés. Ce ne sont pas des corrections :
// l'agence et l'agent ne les voient pas. Le client les retrouve par son lien de
// reprise (?frontnote=<clé>&carnet=<id>), même si son navigateur a tout oublié.
import { z } from 'zod'
import { LOT_MAX, projetOuvert, retourWidget } from './corrections'
import { maintenant } from './dates'
import { transaction, type Db } from './db'
import { DomainError } from './errors'
import { projetIdSchema } from './projets'

export const ENVOYES_MAX = 200
// Carnets abandonnés : oubliés après ce délai sans écriture
const CONSERVATION_JOURS = 180

// Identifiant tiré au hasard par le widget (UUID) : seul secret du carnet
export const carnetIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,64}$/, 'Identifiant de carnet invalide')

const note = retourWidget.extend({
  idLocal: z.string().min(1).max(64),
  numero: z.number().int().min(1),
  creeLe: z.string().max(40),
})

export const carnetSchema = z.object({
  prochainNumero: z.number().int().min(1).max(1_000_000),
  majLe: z.string().max(40).optional(),
  brouillons: z.array(note).max(LOT_MAX),
  envoyes: z
    .array(note.extend({ id: z.string().max(40), envoyeLe: z.string().max(40) }))
    .max(ENVOYES_MAX),
})

export type Carnet = z.infer<typeof carnetSchema>

export const accesCarnetSchema = z.object({
  projet: projetIdSchema,
  cle: z.string().min(1).max(100),
})

export const ecritureCarnetSchema = accesCarnetSchema.extend({ carnet: carnetSchema })

export function lireCarnet(db: Db, projetId: string, cle: string, id: string): Carnet {
  projetOuvert(db, projetId, cle)
  const row = db
    .prepare('SELECT contenu FROM carnets WHERE id = ? AND projet = ?')
    .get(id, projetId) as { contenu: string } | undefined
  if (!row) throw new DomainError(404, 'Carnet introuvable')
  return JSON.parse(row.contenu) as Carnet
}

export function enregistrerCarnet(
  db: Db,
  projetId: string,
  cle: string,
  id: string,
  carnet: Carnet
): void {
  transaction(db, () => {
    projetOuvert(db, projetId, cle)
    const existant = db.prepare('SELECT projet FROM carnets WHERE id = ?').get(id) as
      { projet: string } | undefined
    if (existant && existant.projet !== projetId) {
      throw new DomainError(409, 'Identifiant de carnet déjà pris')
    }
    const now = maintenant()
    db.prepare(
      `INSERT INTO carnets (id, projet, contenu, mis_a_jour_le) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET contenu = excluded.contenu, mis_a_jour_le = excluded.mis_a_jour_le`
    ).run(id, projetId, JSON.stringify(carnet), now)

    const limite = new Date(Date.now() - CONSERVATION_JOURS * 86_400_000).toISOString()
    db.prepare('DELETE FROM carnets WHERE mis_a_jour_le < ?').run(limite)
  })
}
