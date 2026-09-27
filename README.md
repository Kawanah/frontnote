# FrontNote - retours client directement sur la page

Outil transverse de Kawanah Studio pour recueillir les **corrections des
clients** pendant la recette d'un site. Le client clique sur l'élément qui ne va
pas, écrit ce qu'il veut à la place, et l'agence reçoit une correction
**précisément ancrée** : page, élément, écran, texte actuel, texte attendu mot
pour mot. L'**agent de code** lit ensuite ces corrections, les traite et y écrit
son retour, sans intermédiaire.

En ligne : **https://frontnote.kawanah.com** (API + tableau de bord).

> **Vous reprenez ce projet ?** Lisez d'abord [`CLAUDE.md`](CLAUDE.md) :
> architecture, commandes, déploiement, décisions déjà tranchées. Le besoin et
> la feuille de route sont dans [`SPEC.md`](SPEC.md). Le modèle de données suit
> le **contrat de corrections** de l'agence (`Contrat-corrections-agents.md`) :
> le relire avant de toucher aux champs, aux statuts ou aux droits.

---

## Le problème résolu

Les retours d'un client arrivent d'habitude par mail ou en réunion, sous une
forme que personne ne peut exécuter telle quelle : « le bouton en haut, non,
l'autre », « la photo floue sur mobile », un texte recopié à la main avec deux
coquilles de plus. Chaque retour demande un aller-retour pour savoir **où**,
**sur quel écran** et **quoi exactement**.

Le client n'est pas développeur : il ne peut pas désigner un élément autrement
qu'en le montrant. Et depuis que les corrections sont traitées par un agent de
code, le flou coûte deux fois : un agent qui interprète corrige à côté, voire à
l'envers.

La réponse retenue est de **faire désigner l'élément par le client lui-même**,
sur la page réelle, et de transformer ce geste en une correction structurée
selon le contrat de l'agence :

- l'emplacement est relevé automatiquement (adresse, sélecteur, position,
  description de la zone) ;
- le texte actuel est lu sur la page, le **nouveau texte est transmis sans
  aucune retouche** (règle 7.1 du contrat) ;
- l'écran concerné (ordinateur, mobile, les deux) et le contexte technique
  (navigateur, taille d'écran) accompagnent chaque retour ;
- l'agence qualifie, l'agent corrige et rend compte, le client valide :
  **une seule source de vérité**, lisible par l'humain comme par l'agent.

---

## Fonctionnement

Trois briques **découplées**. Seul le widget s'installe sur les sites clients ;
l'API et le tableau de bord ne sont hébergés qu'**une seule fois**, pour tous
les projets.

```
  Client (sur son site)                       Agence
  lien ?frontnote=<clé>                       tableau de bord
          │                                          │
          ▼                                          ▼
 ┌──────────────────────┐   POST /api/corrections   ┌──────────────────────────┐
 │  Widget FrontNote     │ ────────────────────────► │  FrontNote (Astro 7)      │
 │  JS vanilla, Shadow   │   GET /etat?cle=          │  frontnote.kawanah.com    │
 │  DOM, zéro dépendance │ ◄──────────────────────── │                           │
 └──────────────────────┘                            │  API  ─┐                  │
   installé une fois dans                            │  Dash ─┼─► SQLite intégré │
   le layout du site                                 │        │   à Node         │
                                                     └────────┼──────────────────┘
                                                              │ GET / PATCH
                                                              │ (jeton agent)
                                                              ▼
                                                  Agent de code (Claude Code)
                                                  dans le dépôt du site
```

### Le widget

Un script d’environ 16 Ko (6 Ko compressé), sans framework, qui fonctionne pareil sur
Astro, Next ou WordPress. Toute son interface (bouton, surlignage, pins,
formulaire) vit dans un **Shadow DOM** : le style du site ne peut pas l'abîmer,
et le sien ne déborde jamais sur le site. Pendant le mode commentaire, les clics
sont interceptés en phase de capture : cliquer sur un lien le désigne au lieu
de l'ouvrir.

Le client choisit un type simple - texte, couleur, image, lien, bug, autre - et
l'écran concerné. FrontNote en déduit une **nature** proposée, que l'agence
confirme.

### Activation par lien secret

Le widget est **invisible par défaut**, y compris sur le site en ligne. Il ne
s'affiche que pour les personnes qui ont reçu le **lien d'accès** du projet :

| Lien                                     | Effet                                       |
| ---------------------------------------- | ------------------------------------------- |
| `?frontnote=<clé>`                       | clé vérifiée par le serveur, puis mémorisée |
| visites suivantes, sans lien             | le widget reste actif dans ce navigateur    |
| `?frontnote=off`                         | désactive le widget dans ce navigateur      |
| mauvaise clé, clé régénérée, projet clos | rien ne s'affiche, l'activation est oubliée |

La clé est aléatoire et propre au projet ; le nom du projet, lisible dans le
code du site, n'active rien. Le serveur la vérifie **aussi à chaque envoi** :
sans elle, impossible de déposer un retour, même en appelant l'API
directement. « Régénérer la clé » dans le tableau de bord coupe les anciens
liens.

### Le cycle d'une correction

Les statuts et les droits suivent le § 4 du contrat :

```
nouvelle ──► a_traiter ──► en_cours ──► corrigee ──► en_ligne ──► validee
   │             │             │
   │             │             └──► question_client ──► a_traiter
   │             └──► a_faire_client
   └──► hors_perimetre / refusee / doublon
```

- le **client** crée une correction `nouvelle` depuis le widget ;
- l'**agence** la qualifie (nature, gravité, lieu de correction, lot) et la
  passe `a_traiter` ;
- l'**agent** la lit, la corrige sur une branche, écrit son retour (branche,
  PR, résumé en langage clair, vérification) et la passe `corrigee` puis
  `en_ligne` ; **il ne peut jamais poser `validee`** ;
- le client ou l'agence constate et valide.

Chaque changement de statut s'ajoute à un **historique** qu'on ne réécrit
jamais. Chaque écriture porte une **révision** : une écriture fondée sur une
lecture périmée est refusée (409) et l'agent recharge.

### Identifiants

Chaque projet a son **préfixe** (`REC-`, `KAW-`…) et son compteur, qui ne
recule jamais : un identifiant n'est jamais réutilisé, même après
suppression. Deux projets ne peuvent pas partager un préfixe, ce qui rend
chaque identifiant unique sur toute la base et sans ambiguïté dans les
messages de commit.

### Fin de projet

« Clore le projet » télécharge d'abord une **archive JSON** complète, puis
supprime les corrections et leur historique, retire le jeton de l'agent et
**fait disparaître le widget** du site. Le projet est conservé (préfixe et
compteur réservés) et peut être rouvert. Le tableau de bord fournit la
consigne pour que l'agent retire la balise du site.

---

## Rôles et accès

| Rôle       | Accès                                        | Peut                                               |
| ---------- | -------------------------------------------- | -------------------------------------------------- |
| **Client** | lien `?frontnote=<clé>`, sans compte         | créer des corrections depuis le widget             |
| **Agence** | tableau de bord (`DASHBOARD_TOKEN`, session) | qualifier, changer les statuts, régler les projets |
| **Agent**  | jeton par projet, dans le `.env` du site     | lire les corrections, écrire les champs du § 5     |

Le jeton de l'agent n'est **montré qu'une fois** à sa création ; FrontNote n'en
garde que l'empreinte SHA-256.

### API

| Route                                           | Accès         | Rôle                                                  |
| ----------------------------------------------- | ------------- | ----------------------------------------------------- |
| `POST /api/corrections`                         | widget (clé)  | crée une correction `nouvelle`                        |
| `GET /api/projets/:projet/etat?cle=`            | public        | `{ ouvert, active }` : le widget doit-il s'afficher ? |
| `GET /api/projets/:projet/corrections?statut=…` | agent, agence | vue agent, au format du § 6 du contrat, filtrable     |
| `PATCH /api/corrections/:id`                    | agent, agence | mise à jour avec `revision` ; champs limités par rôle |
| `GET /api/health`                               | public        | `{ ok, db, node }` - premier réflexe de diagnostic    |

---

## Installer le widget sur un site

Tout se fait depuis la page du projet dans le tableau de bord.

1. **Créer le projet** : identifiant (minuscules, chiffres, tirets), nom,
   préfixe propre au projet, premier numéro.
2. **Régler les natures actives** (fiche projet du contrat) : par exemple
   `Contenu CMS` et `Légal` pour un site WordPress public.
3. **Générer le jeton agent** et le copier dans le `.env` du site :
   `FRONTNOTE_TOKEN=…`.
4. **Copier la consigne d'installation** et la coller dans une session Claude
   Code ouverte sur le dépôt du site. L'agent ajoute la balise dans le layout
   commun, complète la CSP si le site en a une, ajoute la section
   « Corrections (FrontNote) » au `CLAUDE.md` du site et ouvre une PR.
5. **Fusionner** quand vous le décidez, tester avec le **lien d'accès**, puis
   l'envoyer au client.

La balise, pour mémoire :

```html
<script
  src="https://frontnote.kawanah.com/frontnote.js"
  data-project="coress"
  data-api="https://frontnote.kawanah.com"
  defer
></script>
```

> **CSP.** Si le site envoie une Content-Security-Policy, ajouter
> `https://frontnote.kawanah.com` à `script-src` **et** `connect-src`, une fois
> pour toutes. Sinon le navigateur bloque le widget sans aucun message. Sur un
> site pré-généré, vérifier que l'en-tête est bien envoyé par la page en ligne.

Sites équipés : **CoReSS** (projet `coress`, préfixe `REC-`) et
**www.kawanah.com** (projet `kawanah`, préfixe `KAW-`).

---

## Stack technique

| Techno                  | Rôle                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| **Astro 7**             | API et tableau de bord dans une seule application                       |
| **@astrojs/node**       | Adaptateur standalone - process Node persistant sur O2switch            |
| **node:sqlite**         | Base SQLite intégrée à Node : aucun service externe, aucun module natif |
| **Zod 4**               | Validation de toute donnée entrante de l'API                            |
| **TypeScript** (strict) | Serveur et widget                                                       |
| **tsup**                | Build du widget : ESM (npm) et IIFE (CDN, `frontnote.js`)               |
| **Tailwind 4**          | Styles du tableau de bord                                               |
| **Vitest + happy-dom**  | Tests du widget et de la logique métier                                 |
| **ESLint / Prettier**   | Qualité et format, appliqués au commit                                  |
| **Husky + lint-staged** | Hooks Git - rien de non conforme n'entre dans l'historique              |
| **GitHub Actions**      | Tests, build autonome et déploiement FTPS                               |
| **Bun**                 | Gestionnaire de paquets et lanceur de scripts (workspaces)              |

Le dépôt est un **monorepo** :

```
packages/widget/   @kawanah/frontnote - le widget, seule brique publiée
apps/server/       Astro standalone - routes API + tableau de bord
  src/lib/         logique métier testable sans serveur (db, corrections, projets, auth)
  src/pages/api/   routes de l'API
  src/pages/       pages du tableau de bord
```

---

## Prérequis

- **Node.js ≥ 22.13** (SQLite intégré à Node)
- **Bun** - gestionnaire de paquets du projet (`bun.lock` fait foi)

Aucun service externe : la base est un fichier SQLite créé au premier
démarrage, ses migrations s'appliquent seules (`PRAGMA user_version`).

---

## Installation

```bash
# 1. Récupérer le dépôt
git clone <url-du-depot>
cd frontnote

# 2. Installer les dépendances (installe aussi les hooks Git via Husky)
bun install

# 3. Configurer le serveur
cp apps/server/.env.exemple apps/server/.env
# puis renseigner DASHBOARD_TOKEN - le jeton de connexion au tableau de bord
```

---

## Lancement

```bash
# Tableau de bord + API en développement
bun run dev

# Widget en recompilation continue
bun run dev:widget

# Compilation complète : widget, copie de frontnote.js, serveur
bun run build

# Lancer la compilation comme en production
cd apps/server && PORT=4321 node dist/server/entry.mjs
```

Autres commandes :

```bash
bun run test     # Vitest (widget + serveur)
bun run lint     # ESLint
bun run format   # Prettier
bunx tsc -p packages/widget          # types du widget
cd apps/server && bunx astro check   # types du serveur et des pages
```

**Démo du widget.** `.claude/launch.json` lance le serveur (port 4400) et une
page de démonstration (port 5173). Ouvrir
`http://localhost:5173/demo/?frontnote=<clé du projet demo>` après
`bun run build` ; la clé est affichée sur la page du projet.

**Déploiement.** Il est automatique : **tout `push` sur `main` met
frontnote.kawanah.com en ligne**. Le workflow lance tests et lint, produit un
build autonome (toutes les dépendances embarquées, pas de `npm install` sur le
serveur), l'envoie en FTPS et redémarre l'application via `tmp/restart.txt`.
La base de production n'est jamais touchée par un déploiement ; les migrations
s'appliquent au redémarrage.

---

## Sécurité

**Ce qui n'est jamais commité.** `apps/server/.env`, le jeton agence
(`DASHBOARD_TOKEN`, dans les variables du Node.js Selector d'O2switch), les
identifiants FTP (secrets GitHub Actions), la base de données.

**Garde-fous en place :**

- **Widget invisible sans clé** : le lien d'accès contient une clé aléatoire
  propre au projet, vérifiée par le serveur à l'affichage et à chaque envoi.
- **Formulaire public protégé** : CORS ouvert mais sans cookies, limite de
  30 envois par 10 minutes et par adresse IP, taille maximale par champ,
  validation Zod stricte, champ piège anti-robot.
- **Droits par rôle** côté serveur : l'agent n'écrit que ses champs (§ 5 du
  contrat) et ne peut jamais valider ; le texte du client est **intouchable**,
  y compris depuis le tableau de bord.
- **Jetons agents** : seule leur empreinte SHA-256 est stockée ; comparaison
  à temps constant.
- **Tableau de bord** : session par cookie signé ; en-têtes anti-cadre et
  anti-devinette de type sur toutes les pages.
- **Rien d'exposé publiquement** : la route publique `/etat` ne renvoie que
  `ouvert` et `active`, aucune correction.
- **Aucun module natif** et aucun service tiers : moins de surface, et rien à
  compiler sur l'hébergement.

---

## Et ensuite

- **Notifications Brevo** : un mail à l'agence à chaque nouveau retour.
- **Connexion au tableau de bord** par e-mail et mot de passe, si FrontNote
  s'ouvre à d'autres agences.
- **Pins existants** : montrer au client les retours qu'il a déjà laissés sur
  la page.
