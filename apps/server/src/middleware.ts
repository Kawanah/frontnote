import { defineMiddleware } from 'astro:middleware'
import { sessionRequise } from './lib/acces'
import { SESSION_COOKIE } from './lib/auth'
import { dashboardToken } from './lib/runtime'

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url
  if (sessionRequise(pathname, ctx.cookies.get(SESSION_COOKIE)?.value, dashboardToken)) {
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
