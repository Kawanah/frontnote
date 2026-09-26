# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce qu'est FrontNote

Outil transverse Kawanah Studio : annotation front-end pour corrections client (façon commentaires Vercel Preview / Figma). Le client clique sur un élément de la page, laisse un commentaire, l'agence reçoit une notif avec la position exacte. `SPEC.md` fait foi pour le besoin et les décisions.

## Structure (monorepo bun workspaces)

```
packages/widget/   @kawanah/frontnote — widget vanilla TS, build tsup (ESM npm + IIFE CDN)
apps/server/       Astro 7 standalone — routes API + dashboard, un seul déploiement O2switch
```

## Commandes (depuis la racine)

- `bun install` — installe tout (`bunfig.toml` force `linker = "hoisted"` : ne pas retirer, le serveur Node standalone ne résout pas `cookie` & co en mode isolé)
- `bun run dev` — serveur Astro (API + dashboard)
- `bun run dev:widget` — build widget en watch
- `bun run build` — widget puis serveur
- `bun run test` — Vitest ; test ciblé : `bunx vitest run packages/widget/src/activation.test.ts`
- `bun run lint` / `bun run format`
- Vérif types : `bunx tsc -p packages/widget` · `cd apps/server && bunx astro check`
- Lancer le build serveur : `cd apps/server && PORT=4321 node dist/server/entry.mjs`

TypeScript épinglé en `~6.0` : `@typescript-eslint` ne supporte pas TS 7. tsup a besoin de `ignoreDeprecations: '6.0'` pour le build des types.

## Architecture

Trois briques **découplées**, c'est le point structurant du projet :

1. **Widget** (`@kawanah/frontnote`) — JS vanilla, zéro dépendance framework. Doit marcher identiquement sur Astro, Next, WordPress. Overlay via `pointer-events`, positionnement via `getBoundingClientRect`. C'est la **seule** brique publiée en npm / CDN.
2. **API centrale** — routes API Astro (`apps/server/src/pages/api/`). Endpoints : `POST /comments`, `GET /comments?project=`, `PATCH /comments/:id`. Hébergée **une seule fois**, sert tous les sites clients.
3. **Dashboard** — pages Astro de `apps/server`, vue multi-projets, filtrage par site et par type, marquage résolu.

Contrainte à ne pas casser : **l'API et le dashboard ne sont jamais dupliqués par projet client**. Seul le widget s'installe côté client :

```html
<script src="https://<cdn>/frontnote.js" data-project="coress" data-api="https://<api>"></script>
```

```js
import { initFrontNote } from '@kawanah/frontnote'
initFrontNote({ projectId: 'coress', apiUrl: 'https://<api>' })
```

Activation : widget inactif par défaut, activé par le lien `?frontnote=<projectId>` et mémorisé en `localStorage` ; `?frontnote=off` désactive (`packages/widget/src/activation.ts`).

## Modèle de données

Un commentaire porte : `projectId`, `url` de la page, sélecteur CSS + coordonnées `x`/`y` de l'élément, `type` (`texte` · `couleur` · `photo` · `mise-en-page` · `autre`), `message`, valeur couleur optionnelle, auteur, statut (ouvert/résolu), timestamp.

## Décisions déjà tranchées (ne pas re-litiger)

- **DB : SQLite.** Pas de service externe.
- **Pas de Supabase.** L'outil est transverse, sa DB lui appartient et n'est liée à aucun client.
- **Notifications : Brevo en `fetch` natif**, pas de SDK.
- **Auth dashboard : simple** (utilisatrice unique) — token unique (`DASHBOARD_TOKEN`). Ne pas sur-concevoir.
- **Nom : FrontNote.**
- **Hébergement : sous-domaine O2switch**, Astro standalone.
- **V1 sans screenshot, sans upload photo.**
- **Activation par lien spécial** `?frontnote=<projectId>`.

## Questions ouvertes

À arbitrer avec l'utilisatrice, pas à décider seul :

- Nom final du package (`@kawanah/frontnote` retenu provisoirement)
- Sous-domaine exact de l'API centrale
- Lib SQLite : `node:sqlite` (natif Node, encore expérimental) ou `better-sqlite3` (module compilé, à valider sur O2switch)

## Règles

- Commentaires et communications en français
- Brevo en fetch natif, pas de SDK
- Valider toute entrée de l'API avec Zod ; l'API reçoit des requêtes de domaines tiers (sites clients) → CORS et rate limiting à traiter
- Secrets uniquement dans `.env` (modèle : `apps/server/.env.exemple`)
