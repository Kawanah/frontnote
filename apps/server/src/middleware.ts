import { defineMiddleware } from 'astro:middleware'
import { SESSION_COOKIE, sessionValide } from './lib/auth'
import { dashboardToken } from './lib/runtime'

// Routes accessibles sans session : API (jetons propres), connexion, fichiers publics
const PUBLIQUES = [
  /^\/api\//,
  /^\/connexion$/,
  /^\/frontnote\.js$/,
  /^\/robots\.txt$/,
  /^\/_astro\//,
]

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url
  const publique = PUBLIQUES.some((route) => route.test(pathname))

  if (!publique && !sessionValide(ctx.cookies.get(SESSION_COOKIE)?.value, dashboardToken)) {
    return ctx.redirect('/connexion')
  }

  const response = await next()
  if (!pathname.startsWith('/api/')) {
    try {
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('Referrer-Policy', 'same-origin')
    } catch {
      // réponse aux en-têtes figés (redirection) : rien à ajouter
    }
  }
  return response
})
