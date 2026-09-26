import { defineConfig } from 'tsup'

export default defineConfig([
  // Version npm (import { initFrontNote } from '@kawanah/frontnote')
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    // tsup injecte baseUrl, déprécié en TypeScript 6
    dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
    clean: true,
    target: 'es2020',
  },
  // Version CDN (<script src=".../frontnote.js" data-project="...">)
  {
    entry: { frontnote: 'src/cdn.ts' },
    format: ['iife'],
    minify: true,
    target: 'es2020',
    outExtension: () => ({ js: '.js' }),
  },
])
