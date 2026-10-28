import type { APIRoute } from 'astro'
import { clientIp } from '../lib/http'

// TEMPORAIRE — à retirer une fois clientIp réglé pour O2switch.
// Montre ce que le proxy transmet à l'appli, pour savoir où lire l'IP du visiteur.
// Session agence exigée (route absente de lib/acces.ts) ; cookies et jetons masqués.
const MASQUES = ['cookie', 'authorization']

export const GET: APIRoute = ({ request, clientAddress }) => {
  const enTetes = Object.fromEntries(
    [...request.headers].map(([nom, valeur]) => [nom, MASQUES.includes(nom) ? '(masqué)' : valeur])
  )
  return Response.json(
    { ip_retenue: clientIp(request, clientAddress), adresse_connexion: clientAddress, enTetes },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
