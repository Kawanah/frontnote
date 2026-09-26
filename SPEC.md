# FrontNote

Outil transverse Kawanah Studio — annotation front-end pour corrections client, façon commentaires Vercel Preview / Figma.

## Contexte / problème

Corrections client passent par mail/Slack flous ("le bouton en haut, non l'autre..."). Client pas dev, ne peut pas pointer précisément un élément. Besoin : client clique directement sur la page, laisse un commentaire, l'agence reçoit une notif avec position exacte + contexte.

## Principe

Outil découplé de tout site en particulier — doit marcher pareil que le site client tourne en Astro, WordPress, Next, peu importe la stack.

1. **Widget embed** — petit script JS injecté sur n'importe quelle page. Overlay : clic → pin → formulaire commentaire (+ screenshot optionnel).
2. **API centrale** — un seul backend, hébergé une fois, reçoit les commentaires de tous les sites clients. Stocke : url page, sélecteur CSS/coordonnées élément, texte commentaire, auteur, statut (ouvert/résolu), timestamp, screenshot.
3. **Dashboard** — vue tous commentaires tous projets, filtrable par site, marquage résolu.
4. **Notif** — Brevo (fetch natif, pas de SDK) → email dès nouveau commentaire, lien direct vers le pin sur la page.

## Pourquoi npm

Widget doit s'installer en 1 ligne sur futur site, peu importe la stack :

```html
<script src="https://cdn.tondomaine.com/frontnote.js" data-project="coress"></script>
```

ou version npm pour projets Astro/Next :

```bash
npm install @kawanah/frontnote
```

```js
import { initFrontNote } from '@kawanah/frontnote'
initFrontNote({ projectId: 'coress' })
```

Package = juste le widget (overlay + appels API). API/dashboard restent un service central unique, pas dupliqués par projet — sinon perte de l'intérêt réutilisable.

## Exemple de flow

1. Client ouvre le site (preview ou prod), widget actif (mode staging seulement, toggle via data-attribute).
2. Client clique sur photo bandeau → pin apparaît → tape "remplacer par photo équipe".
3. Widget POST vers API centrale : `{ projectId: 'coress', url, selector, x, y, message }`.
4. API stocke + déclenche Brevo → email avec lien `dashboard.frontnote.app/coress#pin-42`.
5. Clic sur lien → page annotée avec pin en place → correction → marquage résolu.

## Composants techniques (base de départ)

- **Widget** : JS vanilla léger, pas de dépendance framework (doit marcher sur WP aussi) — overlay via `pointer-events` + positionnement via `getBoundingClientRect`.
- **API** : petit Node (Express/Hono) ou Astro API routes standalone — endpoints `POST /comments`, `GET /comments?project=`, `PATCH /comments/:id`.
- **DB** : SQLite (léger, pas de service externe).
- **Auth dashboard** : simple au départ (utilisatrice unique) — token unique ou login basique.
- **Notif** : Brevo fetch natif.

## Décisions V1 (2026-09-26)

- **Hébergement** : API + dashboard sur un sous-domaine O2switch (Node via cPanel). Sous-domaine exact à choisir.
- **Stack serveur** : une seule appli Astro en mode standalone (routes API + pages dashboard). Un seul déploiement.
- **Screenshot auto** : non en V1.
- **Types de retour** : champ `type` sur chaque commentaire — `texte` · `couleur` (avec sélecteur de couleur) · `photo` · `mise-en-page` · `autre`. Filtrable dans le dashboard.
- **Photo** : pas d'upload par le client en V1, il décrit seulement ce qu'il veut.
- **Activation** : lien spécial `?frontnote=<projectId>`. Le script est présent mais invisible ; le lien active le widget et le mémorise dans le navigateur du client (`localStorage`). `?frontnote=off` désactive. Marche en préprod comme en prod, sans compte.

## Reste à trancher

- Nom package (`@kawanah/frontnote` ? — retenu provisoirement)
- Sous-domaine exact de l'API centrale (sert aussi de valeur `data-api` du widget)

## Historique de la réflexion

- Origine : besoin identifié sur projet CoReSS (client, gestion corrections floue).
- Écarté : intégration Supabase — pas prévu sur CoReSS, et outil pensé transverse donc DB propre au projet FrontNote, pas liée à un client.
- Noms envisagés : Kawanah Annotate, Marko, Pinpoint, Feedbay, Griffe, Correcto → retenu **FrontNote**.
- Décision : nouveau repo séparé, pas de code écrit tant que repo/structure pas posés.
