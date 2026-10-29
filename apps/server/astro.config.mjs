// @ts-check
import { defineConfig, envField } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'

export default defineConfig({
  // Adresse publique : sert à la ligne d'installation et à la consigne agent
  site: 'https://frontnote.kawanah.com',
  output: 'server',
  // O2switch proxy : adresse vue en http, le contrôle d'Astro refuserait tout.
  // Remplacé par origineRefusee (src/lib/acces.ts) dans le middleware.
  security: {
    checkOrigin: false,
    // CSP des pages du dashboard : scripts et styles d'Astro autorisés par empreinte,
    // rien d'extérieur. Balise <meta> : frame-ancestors y est ignoré (X-Frame-Options
    // dans le middleware le remplace).
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
    },
  },
  adapter: node({ mode: 'standalone' }),
  build: { inlineStylesheets: 'always' },
  env: {
    schema: {
      DATABASE_PATH: envField.string({
        context: 'server',
        access: 'secret',
        default: './data/frontnote.db',
      }),
      // Absent : les routes protégées refusent tout
      DASHBOARD_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // Tout est inclus dans le build : rien à installer sur O2switch (pas de npm install)
    ssr: { noExternal: true },
  },
})
