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

/* Bouton principal */
.toolbar {
  position: fixed;
  right: 16px;
  bottom: 16px;
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
  pointer-events: auto;
  box-shadow: var(--fn-shadow);
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
  .pin.draft {
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
