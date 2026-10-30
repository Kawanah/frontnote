import type { Gravite, Statut } from './vocabulaire'

// Ligne de ListeInfos : valeur vide → ligne omise ; code → police mono
export interface Info {
  libelle: string
  valeur: string | number | null | undefined
  code?: boolean
}

export type Ton = 'accent' | 'info' | 'warn' | 'ok' | 'ok-plein' | 'danger' | 'neutre'

export const TON_STATUT: Record<Statut, Ton> = {
  nouvelle: 'accent',
  a_traiter: 'info',
  en_cours: 'info',
  question_client: 'warn',
  a_faire_client: 'warn',
  corrigee: 'ok',
  en_ligne: 'ok',
  validee: 'ok-plein',
  hors_perimetre: 'neutre',
  refusee: 'neutre',
  doublon: 'neutre',
}

export const TON_GRAVITE: Record<Gravite, Ton> = {
  bloquante: 'danger',
  majeure: 'warn',
  mineure: 'info',
  cosmetique: 'neutre',
}

const JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const HEURE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})

export const dateCourte = (iso: string) => JOUR.format(new Date(`${iso.slice(0, 10)}T12:00:00`))
export const dateHeure = (iso: string) => HEURE.format(new Date(iso))

// Lien « Voir sur la page » : active le widget avec la clé du projet et lui passe,
// dans le fragment (jamais envoyé au serveur du site), le retour à montrer
export function lienVoir(
  c: {
    id: string
    url: string | null
    selecteur: string | null
    x: number | null
    y: number | null
  },
  cle: string | null
): string | null {
  if (!c.url || !cle) return null
  let url: URL
  try {
    url = new URL(c.url)
  } catch {
    return null
  }
  url.searchParams.set('frontnote', cle)
  url.hash = ''
  if (!c.selecteur || c.x == null || c.y == null) return url.toString()
  const repere = new URLSearchParams({ id: c.id, x: String(c.x), y: String(c.y), s: c.selecteur })
  return `${url.toString()}#frontnote-voir&${repere}`
}
