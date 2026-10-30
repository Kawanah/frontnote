import type { SQLInputValue } from 'node:sqlite'
import { z } from 'zod'
import { cleValide } from './auth'
import { aujourdhui, maintenant } from './dates'
import { transaction, type Db } from './db'
import { DomainError } from './errors'
import { bumpRevision, getProjet, nextId, projetIdSchema, type Projet } from './projets'
import { champsManquants, transitionsPossibles } from './statuts'
import { describeUserAgent } from './userAgent'
import {
  APPAREILS,
  GRAVITES,
  LIEUX,
  NATURE_PAR_TYPE,
  NATURES,
  STATUT_LABELS,
  STATUTS,
  TYPES_CLIENT,
  type Appareil,
  type Gravite,
  type Lieu,
  type Nature,
  type Role,
  type Statut,
  type TypeClient,
} from './vocabulaire'

// --- Schémas -----------------------------------------------------------------

const texteLibre = (max: number) => z.string().trim().max(max)
const optionnel = <T extends z.ZodType>(schema: T) => schema.nullable().optional()
const lienWeb = z.url({ protocol: /^https?$/ }).max(2000)

const taille = z.object({
  width: z.number().int().min(0).max(20_000),
  height: z.number().int().min(0).max(20_000),
})

// Contexte technique relevé automatiquement par le widget
export const contexteSchema = z.object({
  userAgent: z.string().max(500),
  language: z.string().max(35).optional(),
  viewport: taille,
  screen: taille,
  pixelRatio: z.number().min(0).max(10),
  touch: z.boolean(),
})

// Champs d'un retour posé par le widget (sans projet ni clé)
export const retourWidget = z.object({
  url: lienWeb,
  selecteur: z.string().min(1).max(1000),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  type: z.enum(TYPES_CLIENT),
  appareil: z.enum(APPAREILS),
  zone: texteLibre(200).min(1),
  texte_actuel: z.string().max(5000).optional(),
  // Texte du client : ni trim ni normalisation, repris mot pour mot (contrat § 7.1)
  texte_attendu: z.string().max(10_000).optional(),
  constat: texteLibre(2000).optional(),
  attendu: texteLibre(2000).optional(),
  couleur: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  auteur: texteLibre(100).optional(),
  contexte: contexteSchema.optional(),
})

// Texte : le nouveau texte est obligatoire ; autres types : le constat
function retourComplet(s: z.infer<typeof retourWidget>, ctx: z.RefinementCtx) {
  if (s.type === 'texte' && !s.texte_attendu?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['texte_attendu'], message: 'Nouveau texte manquant' })
  }
  if (s.type !== 'texte' && !s.constat) {
    ctx.addIssue({ code: 'custom', path: ['constat'], message: 'Constat manquant' })
  }
}

const accesWidget = {
  projet: projetIdSchema,
  cle: z.string().min(1).max(100), // clé d'activation du lien ?frontnote=<clé>
  _honey: z.string().optional(), // honeypot anti-robot : doit rester vide
}

// Signalement envoyé par le widget (POST /api/corrections)
export const signalementSchema = retourWidget.extend(accesWidget).superRefine(retourComplet)

export const LOT_MAX = 50

// Lot de retours validé par le client en une fois (POST /api/corrections/lot)
export const lotSchema = z.object({
  ...accesWidget,
  corrections: z.array(retourWidget.superRefine(retourComplet)).min(1).max(LOT_MAX),
})

export type Lot = z.infer<typeof lotSchema>
type RetourWidget = z.infer<typeof retourWidget>

export type Signalement = z.infer<typeof signalementSchema>

const commun = {
  revision: z.number().int(),
  statut: z.enum(STATUTS).optional(),
  historique_note: texteLibre(500).optional(),
}

// Champs que l'agence peut modifier (qualification, contrat § 2).
// texte_attendu n'en fait pas partie : le texte du client est intouchable.
export const miseAJourAgenceSchema = z.strictObject({
  ...commun,
  page: texteLibre(300).min(1).optional(),
  etat: optionnel(texteLibre(300)),
  zone: texteLibre(200).min(1).optional(),
  appareil: z.enum(APPAREILS).optional(),
  nature: optionnel(z.enum(NATURES)),
  constat: optionnel(texteLibre(2000)),
  attendu: optionnel(texteLibre(2000)),
  texte_actuel: optionnel(z.string().max(5000)),
  source_texte: optionnel(z.object({ lien: lienWeb, lu_le: z.iso.date() })),
  pieces_jointes: z.array(lienWeb).max(20).optional(),
  gravite: optionnel(z.enum(GRAVITES)),
  test_lie: optionnel(texteLibre(50)),
  ligne_suivi: optionnel(z.number().int().min(1)),
  lieu_correction: optionnel(z.enum(LIEUX)),
  lot: optionnel(texteLibre(100)),
  note: optionnel(texteLibre(2000)),
})

// Champs réservés à l'agent de code (contrat § 5) ; tout autre champ est refusé
export const miseAJourAgentSchema = z.strictObject({
  ...commun,
  traitement: z
    .strictObject({
      branche: texteLibre(200).optional(),
      pr: z.number().int().positive().optional(),
      commits: z
        .array(z.string().regex(/^[0-9a-f]{7,40}$/, 'Empreinte de commit attendue'))
        .max(50)
        .optional(),
      resume: texteLibre(1000).optional(),
      verification: texteLibre(1000).optional(),
      date: z.iso.date().optional(),
    })
    .optional(),
  question: optionnel(texteLibre(2000)),
  signalement: optionnel(texteLibre(2000)),
})

export type MiseAJourAgence = z.infer<typeof miseAJourAgenceSchema>
export type MiseAJourAgent = z.infer<typeof miseAJourAgentSchema>

export const filtreSchema = z.object({
  // Un ou plusieurs statuts séparés par des virgules : a_traiter,question_client
  statut: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(z.enum(STATUTS)))
    .optional(),
  lot: texteLibre(100).optional(),
  nature: z.enum(NATURES).optional(),
  appareil: z.enum(APPAREILS).optional(),
})
export type Filtre = z.infer<typeof filtreSchema>

// --- Modèle ------------------------------------------------------------------

export interface Traitement {
  branche?: string
  pr?: number
  commits?: string[]
  resume?: string
  verification?: string
  date?: string
}

export interface EntreeHistorique {
  date: string
  auteur: Role
  de: Statut | null
  vers: Statut
  note: string
}

export interface Correction {
  id: string
  projet: string
  date_signalement: string
  signale_par: string
  canal: string
  page: string
  etat: string | null
  zone: string
  appareil: Appareil
  navigateur: string | null
  nature: Nature | null
  constat: string | null
  attendu: string | null
  texte_actuel: string | null
  texte_attendu: string | null
  source_texte: { lien: string; lu_le: string } | null
  pieces_jointes: string[]
  gravite: Gravite | null
  test_lie: string | null
  ligne_suivi: number | null
  lieu_correction: Lieu | null
  lot: string | null
  statut: Statut
  question: string | null
  signalement: string | null
  note: string | null
  traitement: Traitement | null
  type_client: TypeClient | null
  url: string | null
  selecteur: string | null
  x: number | null
  y: number | null
  couleur: string | null
  auteur: string | null
  contexte: z.infer<typeof contexteSchema> | null
  cree_le: string
  mis_a_jour_le: string
  revision: number
  historique: EntreeHistorique[]
}

const JSON_COLUMNS = ['source_texte', 'pieces_jointes', 'traitement', 'contexte'] as const
type Row = Record<string, unknown>

function fromRow(row: Row, historique: EntreeHistorique[]): Correction {
  const parsed: Row = { ...row }
  for (const key of JSON_COLUMNS) {
    parsed[key] = typeof row[key] === 'string' ? JSON.parse(row[key] as string) : null
  }
  return { ...(parsed as unknown as Correction), historique }
}

function historiqueDe(db: Db, ids: string[]): Map<string, EntreeHistorique[]> {
  const parCorrection = new Map<string, EntreeHistorique[]>(ids.map((id) => [id, []]))
  if (!ids.length) return parCorrection
  const rows = db
    .prepare(
      `SELECT correction_id, date, auteur, de, vers, note FROM historique
       WHERE correction_id IN (${ids.map(() => '?').join(', ')}) ORDER BY id`
    )
    .all(...ids) as unknown as (EntreeHistorique & { correction_id: string })[]
  for (const { correction_id, ...entree } of rows) parCorrection.get(correction_id)?.push(entree)
  return parCorrection
}

function ajouterHistorique(db: Db, id: string, entree: Omit<EntreeHistorique, 'date'>) {
  db.prepare(
    `INSERT INTO historique (correction_id, date, auteur, de, vers, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, maintenant(), entree.auteur, entree.de, entree.vers, entree.note)
}

// --- Lecture -----------------------------------------------------------------

export function getCorrection(db: Db, id: string): Correction | null {
  const row = db.prepare('SELECT * FROM corrections WHERE id = ?').get(id) as Row | undefined
  if (!row) return null
  return fromRow(row, historiqueDe(db, [id]).get(id) ?? [])
}

export function listCorrections(db: Db, projet: string, filtre: Filtre = {}): Correction[] {
  const where = ['projet = ?']
  const params: SQLInputValue[] = [projet]
  if (filtre.statut?.length) {
    where.push(`statut IN (${filtre.statut.map(() => '?').join(', ')})`)
    params.push(...filtre.statut)
  }
  for (const key of ['lot', 'nature', 'appareil'] as const) {
    if (filtre[key]) {
      where.push(`${key} = ?`)
      params.push(filtre[key] as string)
    }
  }
  const rows = db
    .prepare(
      `SELECT * FROM corrections WHERE ${where.join(' AND ')} ORDER BY cree_le DESC, id DESC`
    )
    .all(...params) as Row[]
  const historiques = historiqueDe(
    db,
    rows.map((r) => r.id as string)
  )
  return rows.map((row) => fromRow(row, historiques.get(row.id as string) ?? []))
}

// --- Création par le widget --------------------------------------------------

// Projet ouvert et clé d'activation valide, sinon erreur lisible pour le widget
export function projetOuvert(db: Db, projetId: string, cle: string): Projet {
  const projet = getProjet(db, projetId)
  if (!projet) throw new DomainError(404, `Projet inconnu : « ${projetId} »`)
  if (projet.clos_le) {
    throw new DomainError(410, `Le projet « ${projet.id} » est clos : il ne reçoit plus de retours`)
  }
  if (!cleValide(projet.cle_activation, cle)) {
    throw new DomainError(403, 'Lien d’activation invalide ou périmé : demandez un nouveau lien')
  }
  return projet
}

// Insère un retour du widget ; à appeler dans une transaction
function insererRetour(db: Db, projet: Projet, input: RetourWidget): string {
  const id = nextId(db, projet.id)
  // Garde-fou : un identifiant déjà pris donne une erreur lisible, pas un 500
  if (db.prepare('SELECT 1 FROM corrections WHERE id = ?').get(id)) {
    throw new DomainError(
      409,
      `L’identifiant ${id} existe déjà : vérifiez le préfixe et le compteur du projet « ${projet.id} »`
    )
  }
  const now = maintenant()
  const proposee = NATURE_PAR_TYPE[input.type]
  const texte = input.type === 'texte'
  const attendu = [input.attendu, input.couleur && `Couleur souhaitée : ${input.couleur}.`]
    .filter(Boolean)
    .join(' ')

  db.prepare(
    `INSERT INTO corrections (
       id, projet, date_signalement, signale_par, canal, page, zone, appareil, navigateur,
       nature, constat, attendu, texte_actuel, texte_attendu, type_client, url, selecteur,
       x, y, couleur, auteur, contexte, cree_le, mis_a_jour_le
     ) VALUES (
       @id, @projet, @date_signalement, 'client', 'app', @page, @zone, @appareil, @navigateur,
       @nature, @constat, @attendu, @texte_actuel, @texte_attendu, @type_client, @url, @selecteur,
       @x, @y, @couleur, @auteur, @contexte, @now, @now
     )`
  ).run({
    id,
    projet: projet.id,
    date_signalement: aujourdhui(),
    page: new URL(input.url).pathname,
    zone: input.zone,
    appareil: input.appareil,
    navigateur: input.contexte ? describeUserAgent(input.contexte.userAgent) : null,
    nature: proposee && projet.natures.includes(proposee) ? proposee : null,
    constat: input.constat || (texte ? 'Le texte affiché doit être remplacé.' : null),
    attendu: attendu || (texte ? 'Le texte attendu ci-dessous, repris mot pour mot.' : null),
    texte_actuel: texte ? (input.texte_actuel ?? null) : null,
    texte_attendu: texte ? (input.texte_attendu ?? null) : null,
    type_client: input.type,
    url: input.url,
    selecteur: input.selecteur,
    x: input.x,
    y: input.y,
    couleur: input.couleur ?? null,
    auteur: input.auteur ?? null,
    contexte: input.contexte ? JSON.stringify(input.contexte) : null,
    now,
  })

  ajouterHistorique(db, id, { auteur: 'client', de: null, vers: 'nouvelle', note: '' })
  return id
}

export function creerDepuisWidget(db: Db, input: Omit<Signalement, '_honey'>): Correction {
  return transaction(db, () => {
    const projet = projetOuvert(db, input.projet, input.cle)
    const id = insererRetour(db, projet, input)
    marquerRevision(db, [id], bumpRevision(db, projet.id))
    return getCorrection(db, id) as Correction
  })
}

// Lot validé par le client : tout ou rien ; identifiants dans l'ordre du lot
export function creerLotDepuisWidget(db: Db, lot: Omit<Lot, '_honey'>): string[] {
  return transaction(db, () => {
    const projet = projetOuvert(db, lot.projet, lot.cle)
    const ids = lot.corrections.map((retour) => insererRetour(db, projet, retour))
    marquerRevision(db, ids, bumpRevision(db, projet.id))
    return ids
  })
}

// Révision du projet à la dernière écriture de ces corrections (contrat v3, § 9)
function marquerRevision(db: Db, ids: string[], revision: number) {
  db.prepare(
    `UPDATE corrections SET revision = ? WHERE id IN (${ids.map(() => '?').join(', ')})`
  ).run(revision, ...ids)
}

// --- Mise à jour par l'agence ou l'agent -------------------------------------

export function mettreAJour(
  db: Db,
  id: string,
  role: 'agence' | 'agent',
  patch: MiseAJourAgence | MiseAJourAgent
): Correction {
  return transaction(db, () => {
    const actuelle = getCorrection(db, id)
    if (!actuelle) throw new DomainError(404, `Correction ${id} introuvable`)
    const projet = getProjet(db, actuelle.projet)
    if (!projet) throw new DomainError(404, `Projet inconnu : « ${actuelle.projet} »`)

    // Révision lue : celle de la correction ou celle du projet (en-tête de l'export).
    // Refus seulement si cette correction a été écrite depuis la lecture (contrat v3, § 9).
    if (patch.revision < actuelle.revision || patch.revision > projet.revision) {
      throw new DomainError(
        409,
        `Révision périmée pour ${id} (${patch.revision} reçue, ${actuelle.revision} pour cette correction) : rechargez-la.`
      )
    }

    const { revision: _revision, statut, historique_note, ...champs } = patch
    const ecrits: Record<string, unknown> = { ...champs }
    if ('traitement' in champs && champs.traitement) {
      ecrits.traitement = { ...actuelle.traitement, ...champs.traitement }
    }
    if ('nature' in champs && champs.nature && !projet.natures.includes(champs.nature)) {
      throw new DomainError(422, `Nature « ${champs.nature} » non active sur ce projet`)
    }

    const suivante = { ...actuelle, ...ecrits } as Correction
    const change = statut !== undefined && statut !== actuelle.statut
    if (change) {
      if (!transitionsPossibles(role, actuelle.statut).includes(statut)) {
        throw new DomainError(
          422,
          `Passage « ${STATUT_LABELS[actuelle.statut]} » → « ${STATUT_LABELS[statut]} » non autorisé pour ${role === 'agent' ? "l'agent" : "l'agence"}`
        )
      }
      const manquants = champsManquants(statut, suivante, role)
      if (manquants.length) {
        throw new DomainError(
          422,
          `Pour passer en « ${STATUT_LABELS[statut]} », il manque : ${manquants.join(', ')}`
        )
      }
      if (statut === 'corrigee') {
        ecrits.traitement = {
          ...suivante.traitement,
          date: suivante.traitement?.date ?? aujourdhui(),
        }
      }
      ecrits.statut = statut
    }

    const colonnes = Object.keys(ecrits)
    if (colonnes.length) {
      const valeurs = colonnes.map((col): SQLInputValue => {
        const value = ecrits[col]
        return (JSON_COLUMNS as readonly string[]).includes(col) && value != null
          ? JSON.stringify(value)
          : ((value ?? null) as SQLInputValue)
      })
      // Noms de colonnes sûrs : clés validées par les schémas stricts ci-dessus
      db.prepare(
        `UPDATE corrections SET ${colonnes.map((c) => `${c} = ?`).join(', ')}, mis_a_jour_le = ?
         WHERE id = ?`
      ).run(...valeurs, maintenant(), id)
    }

    if (change) {
      ajouterHistorique(db, id, {
        auteur: role,
        de: actuelle.statut,
        vers: statut,
        note: historique_note ?? '',
      })
    }
    marquerRevision(db, [id], bumpRevision(db, projet.id))
    return getCorrection(db, id) as Correction
  })
}
