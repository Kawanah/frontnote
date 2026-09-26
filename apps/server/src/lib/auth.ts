import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value).digest()

const egal = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b)

const bearer = (header: string | null) =>
  header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

// Jeton agence (DASHBOARD_TOKEN). Sans token configuré, tout est refusé.
export function isAuthorized(header: string | null, token: string | undefined): boolean {
  const given = bearer(header)
  if (!token || !given) return false
  return egal(digest(given), digest(token))
}

// Jeton agent : généré une fois, seule son empreinte est stockée
export function nouveauJeton(): { jeton: string; empreinte: string } {
  const jeton = `fn_${randomBytes(24).toString('hex')}`
  return { jeton, empreinte: digest(jeton).toString('hex') }
}

// Rôle porté par l'en-tête Authorization pour un projet donné
export function roleFor(
  header: string | null,
  tokenAgence: string | undefined,
  empreinteAgent: string | null
): 'agence' | 'agent' | null {
  if (isAuthorized(header, tokenAgence)) return 'agence'
  const given = bearer(header)
  if (given && empreinteAgent && egal(digest(given), Buffer.from(empreinteAgent, 'hex'))) {
    return 'agent'
  }
  return null
}

// Session du dashboard : cookie signé dérivé du jeton agence
export const SESSION_COOKIE = 'fn_session'

export const valeurSession = (token: string) =>
  createHmac('sha256', token).update('frontnote-dashboard').digest('hex')

export function sessionValide(cookie: string | undefined, token: string | undefined): boolean {
  if (!token || !cookie) return false
  return egal(Buffer.from(cookie), Buffer.from(valeurSession(token)))
}
