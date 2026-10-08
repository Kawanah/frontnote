// Styles du widget, injectés dans son Shadow DOM : isolés du site client
export const STYLES = /* css */ `
:host {
  all: initial;
}

.root {
  --fn-accent: #e8590c;
  --fn-accent-soft: rgb(232 89 12 / 0.1);
  --fn-ink: #1a1a1a;
  --fn-paper: #ffffff;
  --fn-muted: #6b6b6b;
  --fn-line: #deded8;
  --fn-danger: #c92a2a;
  --fn-radius: 12px;
  --fn-shadow: 0 10px 34px rgb(0 0 0 / 0.2);
  --fn-font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: var(--fn-font);
  font-size: 14px;
  line-height: 1.4;
  color: var(--fn-ink);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  font-family: inherit;
}

[hidden] {
  display: none !important;
}

button,
input,
textarea {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--fn-accent);
  outline-offset: 2px;
}

/* Barre d'outils : Mes retours + Commenter */
.bar {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.root.sb-open .bar {
  right: calc(360px + 16px);
}

.toolbar,
.mine {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--fn-ink);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--fn-shadow);
}

.mine {
  background: var(--fn-paper);
  color: var(--fn-ink);
}

.mine[aria-expanded='true'] {
  outline: 2px solid var(--fn-ink);
  outline-offset: -2px;
}

.badge {
  min-width: 22px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--fn-accent);
  color: #fff;
  font-size: 12px;
  text-align: center;
}

.toolbar[aria-pressed='true'] {
  background: var(--fn-accent);
}

.toolbar svg {
  width: 18px;
  height: 18px;
}

/* Élément survolé */
.highlight {
  position: fixed;
  border: 2px solid var(--fn-accent);
  border-radius: 4px;
  background: var(--fn-accent-soft);
  pointer-events: none;
}

/* Pins */
.pin {
  position: fixed;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--fn-ink);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
}

.pin.draft {
  background: var(--fn-accent);
  animation: fn-pulse 1.4s ease-out infinite;
}

/* Brouillon gardé : cliquable pour le modifier */
button.pin {
  padding: 0;
  background: var(--fn-accent);
  cursor: pointer;
  pointer-events: auto;
}

/* Déjà envoyé : lecture seule */
.pin.sent {
  background: var(--fn-muted);
  opacity: 0.85;
}

.pin.flash {
  animation: fn-pulse 0.7s ease-out 3;
}

@keyframes fn-pulse {
  from {
    box-shadow: 0 0 0 0 rgb(232 89 12 / 0.5);
  }
  to {
    box-shadow: 0 0 0 12px rgb(232 89 12 / 0);
  }
}

/* Formulaire */
.panel {
  position: fixed;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: var(--fn-radius);
  background: var(--fn-paper);
  box-shadow: var(--fn-shadow);
  pointer-events: auto;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.panel.sheet {
  left: 8px !important;
  right: 8px;
  top: auto !important;
  bottom: 8px;
  width: auto;
}

.types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
}

.label,
.types legend {
  display: block;
  margin-bottom: 6px;
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--fn-muted);
}

.type input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.type span {
  display: inline-block;
  padding: 6px 11px;
  border: 1px solid var(--fn-line);
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
}

.type input:checked + span {
  border-color: var(--fn-ink);
  background: var(--fn-ink);
  color: #fff;
}

.type input:focus-visible + span {
  outline: 2px solid var(--fn-accent);
  outline-offset: 2px;
}

textarea,
.text {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--fn-line);
  border-radius: 8px;
  background: #fff;
}

textarea {
  min-height: 90px;
  resize: vertical;
}

.current {
  max-height: 96px;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  border-radius: 8px;
  background: #f4f4f1;
  color: var(--fn-muted);
  font-size: 13px;
  white-space: pre-wrap;
}

.swatch {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--fn-line);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.honey {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
}

.error {
  margin: 0;
  font-size: 13px;
  color: var(--fn-danger);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 14px;
  border: 1px solid var(--fn-line);
  border-radius: 8px;
  background: #fff;
  font-weight: 600;
  cursor: pointer;
}

.btn.primary {
  border-color: var(--fn-accent);
  background: var(--fn-accent);
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* Panneau latéral « Mes retours » */
.sidebar {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: var(--fn-paper);
  box-shadow: var(--fn-shadow);
  pointer-events: auto;
}

.sb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--fn-line);
}

.sb-head h2 {
  margin: 0;
  font-size: 16px;
}

.icon {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.icon:hover {
  background: #f4f4f1;
}

.sb-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 16px;
}

.sb-empty,
.sb-note {
  margin: 0;
  color: var(--fn-muted);
  font-size: 13px;
}

.sb-note.strong {
  color: var(--fn-ink);
  font-weight: 600;
}

.sb-body h3 {
  margin: 4px 0 8px;
  font-size: 14px;
}

.sb-sub {
  margin: 16px 0 0;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fn-muted);
}

.group h4 {
  margin: 10px 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fn-muted);
  overflow-wrap: anywhere;
}

.group h4 a {
  color: inherit;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--fn-line);
  border-radius: 10px;
  background: #fff;
}

.card.clickable {
  cursor: pointer;
}

.card.clickable:hover {
  border-color: var(--fn-ink);
}

.card.recent {
  animation: fn-recent 1.6s ease-out;
}

@keyframes fn-recent {
  from {
    background: var(--fn-accent-soft);
    border-color: var(--fn-accent);
  }
}

.num {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--fn-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.num.sent {
  background: var(--fn-muted);
}

.card-body {
  min-width: 0;
  flex: 1;
}

.card-meta {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--fn-muted);
}

.card-text {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.card-warn {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--fn-danger);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  font-size: 13px;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.link.danger {
  color: var(--fn-danger);
}

details[data-envoyes],
details.reprise {
  margin-top: 18px;
}

details.reprise summary {
  font-weight: 600;
  cursor: pointer;
}

details.reprise .sb-note {
  margin: 8px 0;
}

.copie {
  display: flex;
  gap: 6px;
}

.copie .text {
  min-width: 0;
  flex: 1;
  font-size: 12px;
}

.sb-note.warn {
  color: var(--fn-danger);
}

details[data-envoyes] summary {
  font-weight: 600;
  cursor: pointer;
}

details[data-envoyes] .cards {
  margin-top: 8px;
}

.sb-foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--fn-line);
}

.sb-foot.masque {
  display: none;
}

.sb-foot [data-avant-envoi],
.sb-foot [data-confirmation] {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn.wide {
  width: 100%;
  padding: 11px 14px;
}

.form-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-weight: 700;
}

/* Formulaire de modification : dans le panneau, sans ombre ni position propre */
.sidebar .panel {
  position: static;
  width: auto;
  max-height: none;
  padding: 0;
  box-shadow: none;
  overflow: visible;
}

/* Toast centré sur la partie visible de la page */
.root.sb-open .toast {
  left: calc((100% - 360px) / 2);
}

@media (max-width: 480px) {
  .sidebar {
    width: 100%;
  }

  .root.sb-open .toast {
    left: 50%;
  }

  .root.sb-open .bar {
    display: none;
  }
}

/* Confirmation */
.toast {
  position: fixed;
  left: 50%;
  bottom: 72px;
  width: max-content;
  max-width: calc(100vw - 32px);
  text-align: center;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--fn-ink);
  color: #fff;
  font-weight: 600;
  transform: translateX(-50%);
  box-shadow: var(--fn-shadow);
}

@media (prefers-reduced-motion: reduce) {
  .pin.draft,
  .pin.flash,
  .card.recent {
    animation: none;
  }
}
`

// Styles posés sur la page elle-même pendant le mode commentaire
export const PAGE_STYLES = `
html.frontnote-picking,
html.frontnote-picking * {
  cursor: crosshair !important;
  user-select: none !important;
}
`
