import type { APIRoute } from 'astro'
import { aujourdhui } from '../lib/dates'
import { getDb } from '../lib/runtime'
import { sauvegarder } from '../lib/sauvegarde'

// Copie complète de la base (corrections, empreintes des jetons, clés d'activation) :
// session agence uniquement, via le middleware ; ni jeton agent ni accès public.
export const GET: APIRoute = () => {
  let copie: Uint8Array<ArrayBuffer>
  try {
    copie = sauvegarder(getDb())
  } catch (err) {
    console.error(err)
    return new Response('La sauvegarde a échoué', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return new Response(copie, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="frontnote-${aujourdhui()}.db"`,
      'Cache-Control': 'no-store',
    },
  })
}
