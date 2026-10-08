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
