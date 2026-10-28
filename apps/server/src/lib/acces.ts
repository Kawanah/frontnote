import { sessionValide } from './auth'

// Routes accessibles sans session : API (jetons propres), connexion, fichiers publics.
// Tout le reste (dashboard, archives, sauvegarde de la base) exige la session agence.
const PUBLIQUES = [
  /^\/api\//,
  /^\/connexion$/,
  /^\/frontnote\.js$/,
  /^\/robots\.txt$/,
  /^\/_astro\//,
]

export const routePublique = (pathname: string) => PUBLIQUES.some((route) => route.test(pathname))

// Vrai si la requête doit être renvoyée vers /connexion
export function sessionRequise(
  pathname: string,
  cookie: string | undefined,
  token: string | undefined
): boolean {
  return !routePublique(pathname) && !sessionValide(cookie, token)
}

const METHODES_SURES = ['GET', 'HEAD', 'OPTIONS']

// Vrai si un formulaire du dashboard arrive d'une autre origine (CSRF). Le cookie
// SameSite=strict ne suffit pas : il part aussi depuis un sous-domaine de
// kawanah.com. Le contrôle d'Astro (checkOrigin) est coupé, l'adresse vue derrière le
// proxy O2switch étant en http ; on compare donc aussi à l'adresse publique (site).
// L'API n'est pas concernée : elle n'accepte que des jetons, jamais le cookie, pour écrire.
export function origineRefusee(
  method: string,
  pathname: string,
  headers: Headers,
  attendues: readonly string[]
): boolean {
  if (METHODES_SURES.includes(method) || /^\/api\//.test(pathname)) return false
  const origine = headers.get('origin')
  // Navigateur qui n'envoie pas Origin : il dit quand même d'où vient la requête
  if (!origine || origine === 'null') return headers.get('sec-fetch-site') !== 'same-origin'
  return !attendues.includes(origine)
}
