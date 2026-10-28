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

- `bun install` — installe tout (`bunfig.toml` force `linker = "hoisted"`)
- `bun run dev` — serveur Astro (API + dashboard)
- `bun run dev:widget` — build widget en watch
- `bun run build` — widget puis serveur
- `bun run test` — Vitest ; test ciblé : `bunx vitest run packages/widget/src/activation.test.ts`
- `bun run lint` / `bun run format`
- Vérif types : `bun run typecheck` (`tsc -p packages/widget` puis `astro check`)
- Garde-fous du serveur compilé : `bun run build && bun run verif:serveur` (`scripts/verif-serveur.mjs` : démarre `dist/` sur une base vide, contrôle l'origine des formulaires et la limite de débit derrière proxy). Un échec bloque la mise en ligne
- Démo widget : `.claude/launch.json` → `server` (port 4400) + `demo` (port 5173, sert `packages/widget` ; 2 pages : `demo/` et `demo/tarifs.html`). Si `astro dev` échoue (`require is not defined`), `server-build` lance le build (`bun run build` avant ; base `apps/server/data/`, sans `DASHBOARD_TOKEN`) ; ouvrir `http://localhost:5173/demo/?frontnote=<clé du projet demo>` (lien d'accès affiché sur la page du projet) après `bun run build`. Le 4321 est souvent pris par d'autres projets Astro
- Lancer le build serveur : `cd apps/server && PORT=4321 node dist/server/entry.mjs`
- Dev : `apps/server/.env` (non versionné) doit contenir `DASHBOARD_TOKEN` pour se connecter au dashboard

## Installer le widget sur un site

1. Créer le projet dans le dashboard ; copier la ligne `<script>` (sur Astro : `is:inline`), avant `</body>`.
2. **CSP du site** : ajouter `https://frontnote.kawanah.com` à `script-src` **et** `connect-src`, sinon le widget est bloqué sans message. Vérifier sur la page **en ligne** que l'en-tête CSP est bien envoyé : sur un site Astro pré-généré, le middleware ne tourne pas pour les pages statiques (cas de www.kawanah.com au 2026-09-26).
3. Tester avec le **lien d'accès** du dashboard (`?frontnote=<clé>`) sur ordi et mobile, puis l'envoyer au client.
4. Pour l'agent de code : jeton agent dans le `.env` du site + consigne dans son `CLAUDE.md` (fournis par le dashboard).

Premier site équipé : www.kawanah.com (projet `kawanah`, dépôt `Kawanah/Kawanah`).

## Déploiement (O2switch, https://frontnote.kawanah.com)

- Dépôt `Kawanah/frontnote` (privé). **Un push sur `main` met en ligne** via `.github/workflows/deploy.yml` : tests, lint, types, `bun run paquet`, `verif:serveur` (→ `deploy/frontnote/`), envoi FTPS dans `apps/frontnote/`, redémarrage par `tmp/restart.txt` (Passenger). Sans secrets FTP, rien n'est envoyé.
- Secrets GitHub : `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` uniquement. `DASHBOARD_TOKEN` et `NODE_ENV=production` vivent dans les variables du Node.js Selector (lues au démarrage, pas au build).
- Build autonome (`vite.ssr.noExternal: true` dans `astro.config.mjs`) : `dist/` contient toutes les dépendances, le `package.json` déployé n'en a aucune. **Plus besoin de « Run NPM Install »** ; une nouvelle dépendance ne doit pas être native.
- `GET /api/health` → `{ ok, db, node }` (503 si la base ne s'ouvre pas) : premier réflexe de diagnostic.
- La base (`apps/frontnote/data/`) n'est jamais touchée par le déploiement.
- **Sauvegarde** : lien « Télécharger une sauvegarde » sur l'accueil du dashboard → `GET /sauvegarde.db` (session agence seule : ni jeton agent ni accès public, la copie contient empreintes des jetons et clés d'activation). Copie par `VACUUM INTO` dans un dossier temporaire supprimé aussitôt (`lib/sauvegarde.ts`), cohérente même en WAL ; ne jamais copier le `.db` à la main pendant que l'app tourne. Pas encore de sauvegarde automatique.
- Pièges rencontrés au premier déploiement : nom de variable mal saisi dans le Node.js Selector (`DASHBOARDS_TOKEN`, variable sans nom `=production`) → vérifier les noms lettre par lettre ; module natif (`better-sqlite3`) non installable → uniquement du JS pur ou des modules intégrés à Node.

TypeScript épinglé en `~6.0` : `@typescript-eslint` ne supporte pas TS 7. tsup a besoin de `ignoreDeprecations: '6.0'` pour le build des types.

## Architecture

Trois briques **découplées**, c'est le point structurant du projet :

1. **Widget** (`@kawanah/frontnote`) — JS vanilla, zéro dépendance framework. Doit marcher identiquement sur Astro, Next, WordPress. Overlay via `pointer-events`, positionnement via `getBoundingClientRect`. C'est la **seule** brique publiée en npm / CDN.
2. **API centrale** — routes API Astro (`apps/server/src/pages/api/`), hébergée **une seule fois**, sert tous les sites clients :
   - `POST /api/corrections/lot` — public (widget) : `{ projet, cle, _honey?, corrections: [...] }` (1 à 50), tout ou rien, renvoie `{ ids }` dans l'ordre. CORS `*`, rate limit 30/10 min/IP (un lot = un envoi), Zod, honeypot `_honey` (faux 201). Exige la clé d'activation `cle` (403 sinon) ; projet inconnu → 404, clos → 410
   - `GET` / `PUT /api/carnets/:id` — public (widget), `projet` + `cle` exigés (en query pour GET, dans le corps pour PUT) : copie serveur du carnet du client (brouillons, envoyés, numéro suivant). L'`id` (128 bits aléatoires, tiré par le widget) est le seul secret : lien de reprise `?frontnote=<clé>&carnet=<id>`. Invisible pour l'agence et l'agent ; purgé à la clôture du projet et après 180 jours sans écriture. Limite 300/10 min/IP (`limiteCarnets`)
   - `POST /api/corrections` — même chose pour un seul retour ; gardé pour les anciens widgets en cache, le widget actuel n'envoie que des lots
   - `GET /api/projets/:projet/etat?cle=` — public (widget) : `{ ouvert, active }` (active = ouvert et clé valide), 404 si projet inconnu. Rien d'autre n'est exposé
   - `GET /api/projets/:projet/corrections?statut=a_traiter,question_client&lot=&nature=&appareil=` — **vue agent**, JSON au format du § 6 du contrat. Jeton agent du projet, jeton agence ou session du dashboard
   - `PATCH /api/corrections/:id` `{ revision, statut?, ...champs }` — l'agent n'écrit que les champs du § 5 (schéma strict), l'agence ceux de qualification ; `revision` périmée → 409
   - Rôles (`lib/auth.ts`) : agence = `DASHBOARD_TOKEN` ; agent = jeton par projet (seule son empreinte SHA-256 est stockée, généré depuis le dashboard) ; client = widget sans jeton
   - Logique métier dans `src/lib/` (testable sans serveur) ; seul `src/lib/runtime.ts` lit `astro:env`. Limiteurs dans `lib/limites.ts` (le frontmatter d'une page Astro s'exécute à chaque requête)
3. **Dashboard** — pages Astro (`/`, `/projets/:projet`, `/projets/:projet/:id`), session par cookie signé après saisie du jeton agence (`/connexion`, `middleware.ts` ; routes publiques listées dans `lib/acces.ts`, tout le reste exige la session). Formulaires (POST hors `/api/`) refusés en 403 si `Origin` n'est pas le dashboard (`origineRefusee`) : `checkOrigin` d'Astro reste coupé à cause du proxy, et `SameSite=strict` laisse passer les sous-domaines de kawanah.com. Limites de débit par IP = **dernière** adresse de `X-Forwarded-For` (`clientIp`), les premières sont inventables par le client. Qualification, changements de statut, retour de l'agent, historique, accès agent (URL, jeton, consigne CLAUDE.md, « Copier pour l'agent »), ligne d'installation du widget.

Contrainte à ne pas casser : **l'API et le dashboard ne sont jamais dupliqués par projet client**. Seul le widget s'installe côté client :

```html
<script
  src="https://<api>/frontnote.js"
  data-project="coress"
  data-api="https://<api>"
  defer
></script>
```

```js
import { initFrontNote } from '@kawanah/frontnote'
initFrontNote({ projectId: 'coress', apiUrl: 'https://<api>' })
```

Widget (`packages/widget/src/`) : `overlay.ts` = UI dans un Shadow DOM (barre « Mes retours » + « Commenter », surlignage, pins), écouteurs en phase de capture sur `window` qui neutralisent les clics du site pendant le mode commentaire ; `mountOverlay` renvoie une fonction de nettoyage. `form.ts` = formulaire (création ancrée au pin, modification dans le panneau). `sidebar.ts` = panneau latéral « Mes retours ». `notes.ts` = carnet en `localStorage` (`frontnote:notes:<projet>`) : brouillons modifiables (50 au plus = un lot), retours envoyés en lecture seule, numéro stable par note (jamais réattribué), effacé si le projet est clos ou la clé refusée. `sync.ts` = copie serveur du carnet : écriture 1 s après chaque changement, au chargement la copie la plus récente (`majLe`) l'emporte ; ouvrir un lien de reprise dans un navigateur qui a ses propres brouillons les fusionne (numérotés à la suite). Panneau : lien de reprise à copier, état de la sauvegarde, rappel « pas encore envoyés ». `selector.ts` = sélecteur sans classes (#id simple sinon `tag:nth-of-type`). Types client et appareils dupliqués dans `types.ts` et `apps/server/src/lib/vocabulaire.ts` : les garder synchronisés. Type Texte : le « texte actuel » est relevé sur l'élément, le « nouveau texte » est envoyé **sans aucune retouche** (pas de trim). `zone` est décrite automatiquement (`describeElement`). Pins affichés = notes du carnet de ce navigateur pour la page courante (brouillons cliquables, envoyés grisés) ; rien n'est relu sur le serveur. Navigation sans rechargement : l'adresse est surveillée (500 ms) et le widget se ré-attache si le `<body>` est remplacé.

Activation : widget inactif par défaut, activé par le lien `?frontnote=<clé d'activation>` (clé aléatoire par projet, `projets.cle_activation`, migration 4, régénérable dans le dashboard). Le widget fait vérifier la clé par `/etat?cle=` : acceptée → mémorisée en `localStorage` ; refusée, projet clos ou inconnu → rien ne s'affiche et l'activation est oubliée ; serveur injoignable → il s'affiche (l'envoi tranchera). `POST /api/corrections` exige `cle` (403 sinon). `?frontnote=off` désactive (`packages/widget/src/activation.ts`). Dès le chargement, `frontnote` et `carnet` sont retirés de l'adresse (`history.replaceState`) : ils ne partent ni dans les outils de mesure du site, ni dans les liens copiés. L'ancien lien `?frontnote=<projet>` n'active plus rien.

Clôture d'un projet (dashboard, page projet) : archive JSON (`/projets/:projet/archive.json`), puis `clore()` supprime corrections et historique, retire le jeton agent, pose `projets.clos_le` (migration 3). Le projet reste : préfixe et compteur réservés. « Rouvrir » reprend la numérotation. Le bandeau fournit la consigne pour que l'agent retire le widget du site.

## Modèle de données : contrat de corrections

Le modèle suit `/Users/martinlaetitia/Documents/011-KAWANAH-STUDIO/Contrat-corrections-agents.md` (v2). **Le relire avant toute modification** des champs, statuts ou droits. Vocabulaire et libellés : `apps/server/src/lib/vocabulaire.ts`.

- Tables (`lib/db.ts`, migrations suivies par `PRAGMA user_version` ; ne jamais modifier une migration déployée, en ajouter une) : `projets` (préfixe, compteur qui ne recule jamais, natures actives, empreinte du jeton agent, `revision`), `corrections` (colonnes = noms de champs du contrat, + ancrage `url`/`selecteur`/`x`/`y`, `type_client`, `couleur`, `auteur`, `contexte`), `historique` (ajout seul), `carnets` (migration 5 : brouillons du widget, hors contrat, JSON).
- Identifiants `REC-001` par projet (préfixe et premier numéro réglables à la création). **Préfixe unique par projet** (index `projets_prefixe`, migration 2) : `corrections.id` est unique pour toute la base. `kawanah` = `KAW-`, `coress` = `REC-`.
- Statuts et droits : `lib/corrections.ts` (`CIBLES` par rôle, `DEPUIS` par statut, `champsManquants`). L'agent ne pose jamais `validee`.
- Le client choisit un type simple (texte, couleur, image, lien, bug, autre) → `nature` proposée (`NATURE_PAR_TYPE`), confirmée par l'agence. Écran : Desktop / Mobile / Les deux → `appareil` `ordinateur` / `mobile` / `tous`.
- `texte_attendu` : jamais retouché, jamais modifiable dans le dashboard (règle 7.1).
- Chaque écriture incrémente `projets.revision`.

## Décisions déjà tranchées (ne pas re-litiger)

- **DB : SQLite intégré à Node (`node:sqlite`, Node ≥ 22.13).** Pas de service externe, aucun module compilé. `better-sqlite3` abandonné le 2026-09-26 : son installation échouait sur O2switch.
- **Pas de Supabase.** L'outil est transverse, sa DB lui appartient et n'est liée à aucun client.
- **Notifications : Brevo en `fetch` natif**, pas de SDK.
- **Auth dashboard : simple** (utilisatrice unique) — jeton agence `DASHBOARD_TOKEN` + cookie de session signé. Ne pas sur-concevoir.
- **Nom : FrontNote.**
- **Hébergement : sous-domaine O2switch**, Astro standalone.
- **V1 sans screenshot, sans upload d'image.**
- **Pas de priorité côté client** : l'écran concerné à la place ; la `gravite` du contrat est posée par l'agence.
- **Le dashboard est la source unique** des corrections, lu et mis à jour par l'agent de code (réponses au § 9 dans `SPEC.md`).
- **Activation par lien spécial** `?frontnote=<clé d'activation>` (clé secrète par projet depuis le 2026-09-27 ; le nom du projet, lisible dans `data-project`, n'active plus rien).

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
