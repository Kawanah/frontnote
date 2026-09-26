import type { Gravite, Statut } from './vocabulaire'

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
