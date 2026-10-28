// Vérification du serveur compilé, avant chaque mise en ligne (CI) : démarre
// dist/server/entry.mjs sur une base vide et contrôle les garde-fous de sécurité
// tels qu'ils sont branchés (middleware, limites de débit), pas seulement les
// fonctions de lib/. À lancer après « bun run build » : bun run verif:serveur
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const entree = join(racine, 'apps/server/dist/server/entry.mjs')
// Adresse publique (site dans astro.config.mjs) : celle que le navigateur envoie en Origin
const SITE = 'https://frontnote.kawanah.com'
const JETON = 'jeton-de-verification'

const portLibre = () =>
  new Promise((resolve) => {
    const serveur = createServer().listen(0, '127.0.0.1', () => {
      const { port } = serveur.address()
      serveur.close(() => resolve(port))
    })
  })

const dossier = mkdtempSync(join(tmpdir(), 'frontnote-verif-'))
const port = await portLibre()
const base = `http://127.0.0.1:${port}`
let journal = ''
const serveur = spawn(process.execPath, [entree], {
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    DATABASE_PATH: join(dossier, 'frontnote.db'),
    DASHBOARD_TOKEN: JETON,
  },
})
serveur.stdout.on('data', (d) => (journal += d))
serveur.stderr.on('data', (d) => (journal += d))

const echecs = []
function verifier(libelle, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${libelle}${ok ? '' : ` — ${detail}`}`)
  if (!ok) echecs.push(libelle)
}

const envoyer = (chemin, { headers = {}, corps, ...options } = {}) =>
  fetch(`${base}${chemin}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: corps === undefined ? undefined : new URLSearchParams(corps),
    ...options,
  })

async function attendreDemarrage() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Le serveur ne démarre pas :\n${journal}`)
}

try {
  await attendreDemarrage()

  // --- Formulaires du dashboard : origine contrôlée par le middleware ---------

  let r = await envoyer('/connexion', {
    headers: { Origin: 'https://www.kawanah.com' },
    corps: { jeton: JETON },
  })
  verifier('connexion depuis un sous-domaine refusée', r.status === 403, `statut ${r.status}`)

  r = await envoyer('/connexion', { headers: { Origin: base }, corps: { jeton: JETON } })
  const cookie = r.headers.get('set-cookie')?.split(';')[0] ?? ''
  verifier(
    'connexion depuis le dashboard acceptée',
    r.status === 302 && cookie !== '',
    `statut ${r.status}`
  )

  const projet = { id: 'verif', nom: 'Vérification' }
  r = await envoyer('/', {
    headers: { Cookie: cookie, Origin: 'https://www.kawanah.com' },
    corps: projet,
  })
  verifier(
    'formulaire venu d’un sous-domaine refusé, même avec la session',
    r.status === 403,
    `statut ${r.status}`
  )

  r = await envoyer('/', { headers: { Cookie: cookie }, corps: projet })
  verifier(
    'formulaire sans Origin ni Sec-Fetch-Site refusé',
    r.status === 403,
    `statut ${r.status}`
  )

  r = await fetch(`${base}/projets/verif`, { headers: { Cookie: cookie }, redirect: 'manual' })
  verifier('aucun projet créé par les formulaires refusés', r.status === 404, `statut ${r.status}`)

  // Derrière le proxy O2switch, l'adresse vue est en http mais le navigateur envoie https
  r = await envoyer('/', { headers: { Cookie: cookie, Origin: SITE }, corps: projet })
  verifier('formulaire depuis l’adresse publique accepté', r.status === 302, `statut ${r.status}`)

  r = await fetch(`${base}/api/corrections/lot`, {
    method: 'POST',
    headers: { Origin: 'https://site-client.fr', 'Content-Type': 'application/json' },
    body: JSON.stringify({ projet: 'verif', cle: 'x', corrections: [] }),
  })
  verifier('API du widget ouverte aux sites clients', r.status === 400, `statut ${r.status}`)

  // --- Limite de débit : IP ajoutée par le proxy, pas celle inventée par le client

  let bloque = false
  for (let i = 1; i <= 11; i++) {
    r = await envoyer('/connexion', {
      headers: { Origin: base, 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.7` },
      corps: { jeton: 'faux' },
    })
    bloque = (await r.text()).includes('Trop de tentatives')
  }
  verifier('11e connexion ratée bloquée malgré une fausse IP à chaque essai', bloque)

  r = await envoyer('/connexion', {
    headers: { Origin: base, 'X-Forwarded-For': '203.0.113.8' },
    corps: { jeton: 'faux' },
  })
  verifier('une autre IP n’est pas bloquée', !(await r.text()).includes('Trop de tentatives'))
} catch (err) {
  verifier('vérification menée jusqu’au bout', false, err.message)
} finally {
  serveur.kill()
  rmSync(dossier, { recursive: true, force: true })
}

if (echecs.length) {
  console.error(`\n${echecs.length} vérification(s) en échec.`)
  process.exit(1)
}
console.log('\nServeur compilé : garde-fous en place.')
