// @ts-check
import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  security: { checkOrigin: false }, // O2switch proxy
  adapter: node({ mode: 'standalone' }),
  build: { inlineStylesheets: 'always' },
  vite: { plugins: [tailwindcss()] },
})
