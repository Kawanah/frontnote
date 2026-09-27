import type { SQLInputValue } from 'node:sqlite'
import { z } from 'zod'
import { aujourdhui, maintenant } from './dates'
import { transaction, type Db } from './db'
import { DomainError } from './errors'
import { bumpRevision, getProjet, nextId, projetIdSchema, type Projet } from './projets'
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

// Signalement envoyé par le widget (POST /api/corrections)
export const signalementSchema = z
  .object({
    projet: projetIdSchema,
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
    _honey: z.string().optional(), // honeypot anti-robot : doit rester vide
  })
  .superRefine((s, ctx) => {
    if (s.type === 'texte' && !s.texte_attendu?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['texte_attendu'], message: 'Nouveau texte manquant' })
    }
    if (s.type !== 'texte' && !s.constat) {
      ctx.addIssue({ code: 'custom', path: ['constat'], message: 'Constat manquant' })
    }
  })

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

export function creerDepuisWidget(db: Db, input: Omit<Signalement, '_honey'>): Correction {
  return transaction(db, () => {
    const projet = getProjet(db, input.projet)
    if (!projet) throw new DomainError(404, `Projet inconnu : « ${input.projet} »`)
    if (projet.clos_le) {
      throw new DomainError(
        410,
        `Le projet « ${projet.id} » est clos : il ne reçoit plus de retours`
      )
    }

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
    bumpRevision(db, projet.id)
    return getCorrection(db, id) as Correction
  })
}

// --- Statuts (contrat § 4) ---------------------------------------------------

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
function champsManquants(vers: Statut, c: Correction, role: 'agence' | 'agent'): string[] {
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

    if (patch.revision !== projet.revision) {
      throw new DomainError(
        409,
        `Révision périmée (${patch.revision} reçue, ${projet.revision} en cours) : rechargez les corrections.`
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
    bumpRevision(db, projet.id)
    return getCorrection(db, id) as Correction
  })
}

// --- Export pour l'agent (contrat § 6) ---------------------------------------

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

// --- Clôture d'un projet -----------------------------------------------------

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

// Fin de projet : supprime corrections et historique, retire le jeton agent, refuse le
// widget. Le projet reste : préfixe et compteur ne servent jamais deux fois (§ 7.4).
export function clore(db: Db, projetId: string): number {
  return transaction(db, () => {
    if (!getProjet(db, projetId)) throw new DomainError(404, `Projet inconnu : « ${projetId} »`)
    db.prepare(
      'DELETE FROM historique WHERE correction_id IN (SELECT id FROM corrections WHERE projet = ?)'
    ).run(projetId)
    const { changes } = db.prepare('DELETE FROM corrections WHERE projet = ?').run(projetId)
    db.prepare('UPDATE projets SET clos_le = ?, jeton_agent = NULL WHERE id = ?').run(
      maintenant(),
      projetId
    )
    bumpRevision(db, projetId)
    return Number(changes)
  })
}
