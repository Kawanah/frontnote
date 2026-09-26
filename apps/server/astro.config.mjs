// @ts-check
import { defineConfig, envField } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'

export default defineConfig({
  // Adresse publique : sert à la ligne d'installation et à la consigne agent
  site: 'https://frontnote.kawanah.com',
  output: 'server',
  security: { checkOrigin: false }, // O2switch proxy
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
