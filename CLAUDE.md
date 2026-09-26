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
- Démo widget : `.claude/launch.json` → `server` (port 4400) + `demo` (port 5173, sert `packages/widget`) ; ouvrir `http://localhost:5173/demo/?frontnote=demo` après `bun run build`. Le 4321 est souvent pris par d'autres projets Astro
- Lancer le build serveur : `cd apps/server && PORT=4321 node dist/server/entry.mjs`

TypeScript épinglé en `~6.0` : `@typescript-eslint` ne supporte pas TS 7. tsup a besoin de `ignoreDeprecations: '6.0'` pour le build des types.

## Architecture

Trois briques **découplées**, c'est le point structurant du projet :

1. **Widget** (`@kawanah/frontnote`) — JS vanilla, zéro dépendance framework. Doit marcher identiquement sur Astro, Next, WordPress. Overlay via `pointer-events`, positionnement via `getBoundingClientRect`. C'est la **seule** brique publiée en npm / CDN.
2. **API centrale** — routes API Astro (`apps/server/src/pages/api/`), hébergée **une seule fois**, sert tous les sites clients :
   - `POST /api/comments` — public (widget) : CORS `*`, rate limit 30/10 min/IP, validation Zod, honeypot `_honey` (faux 201 si rempli)
   - `GET /api/comments?project=&status=&type=&priority=` — token requis
   - `PATCH /api/comments/:id` `{ status?, priority? }` — token requis
   - Auth : `Authorization: Bearer <DASHBOARD_TOKEN>` ; token absent → tout refusé
   - Logique métier dans `src/lib/` (testable sans serveur) ; seul `src/lib/runtime.ts` lit `astro:env`
3. **Dashboard** — pages Astro de `apps/server`, vue multi-projets, filtrage par site et par type, marquage résolu.

Contrainte à ne pas casser : **l'API et le dashboard ne sont jamais dupliqués par projet client**. Seul le widget s'installe côté client :

```html
<script src="https://<cdn>/frontnote.js" data-project="coress" data-api="https://<api>"></script>
```

```js
import { initFrontNote } from '@kawanah/frontnote'
initFrontNote({ projectId: 'coress', apiUrl: 'https://<api>' })
```

Widget (`packages/widget/src/`) : `overlay.ts` = UI dans un Shadow DOM (bouton, surlignage, pins, formulaire), écouteurs en phase de capture sur `window` qui neutralisent les clics du site pendant le mode commentaire ; `mountOverlay` renvoie une fonction de nettoyage. `selector.ts` = sélecteur sans classes (#id simple sinon `tag:nth-of-type`). Les types de retour sont dupliqués dans `types.ts` et `apps/server/src/lib/comments.ts` : les garder synchronisés. Pins affichés = ceux envoyés pendant la visite uniquement.

Activation : widget inactif par défaut, activé par le lien `?frontnote=<projectId>` et mémorisé en `localStorage` ; `?frontnote=off` désactive (`packages/widget/src/activation.ts`).

## Modèle de données

Table SQLite `comments`. Schéma = migrations dans `apps/server/src/lib/db.ts` (suivies par `PRAGMA user_version`, appliquées à l'ouverture) : ne jamais modifier une migration publiée, en ajouter une. Les listes (types, priorités, statuts) sont validées par Zod, pas par des `CHECK`. Un commentaire porte : `projectId`, `url` de la page, sélecteur CSS + `x`/`y` = position du clic **dans l'élément**, en fraction de sa taille (0 à 1), `type` (`texte` · `couleur` · `photo` · `mise-en-page` · `bug` · `autre`), `priority` (`bloquant` · `a-corriger` · `suggestion`), `message`, valeur couleur optionnelle, auteur, `context` (JSON : UA, langue, fenêtre, écran, densité, tactile — relevé par `packages/widget/src/context.ts`), statut (ouvert/résolu), timestamp.

## Décisions déjà tranchées (ne pas re-litiger)

- **DB : SQLite via `better-sqlite3`.** Pas de service externe. Module compilé : valider l'install au premier déploiement O2switch.
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
- Lecture des pins par le widget (afficher au client ses commentaires existants) : nécessite une lecture publique par projet, à cadrer

## Règles

- Commentaires et communications en français
- Brevo en fetch natif, pas de SDK
- Valider toute entrée de l'API avec Zod ; l'API reçoit des requêtes de domaines tiers (sites clients) → CORS et rate limiting à traiter
- Secrets uniquement dans `.env` (modèle : `apps/server/.env.exemple`)
