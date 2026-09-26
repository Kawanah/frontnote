// Sélecteur CSS unique d'un élément : #id si fiable, sinon chemin
// tag:nth-of-type depuis l'ancêtre identifiable le plus proche.
// Pas de classes : elles changent souvent (Tailwind, hash Astro, builders WP).
// Id retenu seulement s'il est simple : les id exotiques sont souvent générés.
const SIMPLE_ID = /^[A-Za-z][\w-]*$/

export function getSelector(el: Element): string {
  const doc = el.ownerDocument
  const parts: string[] = []
  let node: Element | null = el

  while (node && node !== doc.documentElement) {
    if (SIMPLE_ID.test(node.id)) {
      const byId = `#${node.id}`
      if (doc.querySelectorAll(byId).length === 1) {
        parts.unshift(byId)
        break
      }
    }
    const tag = node.tagName.toLowerCase()
    const parent: Element | null = node.parentElement
    if (!parent) {
      parts.unshift(tag)
      break
    }
    const current: Element = node
    const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName)
    parts.unshift(
      siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag
    )
    node = parent
  }

  return parts.join(' > ')
}

export interface Position {
  x: number
  y: number
}

// Position du clic dans l'élément, en fraction de sa taille (0 à 1)
export function getClickPosition(rect: DOMRect, clientX: number, clientY: number): Position {
  const ratio = (offset: number, size: number) =>
    size > 0 ? Math.round(Math.min(1, Math.max(0, offset / size)) * 10_000) / 10_000 : 0.5
  return { x: ratio(clientX - rect.left, rect.width), y: ratio(clientY - rect.top, rect.height) }
}

// Texte visible d'un élément, espaces regroupés (sert de « texte actuel »)
export function readText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 5000)
}

const NOMS: Record<string, string> = {
  a: 'lien',
  button: 'bouton',
  p: 'paragraphe',
  img: 'image',
  picture: 'image',
  svg: 'icône',
  video: 'vidéo',
  li: 'élément de liste',
  ul: 'liste',
  ol: 'liste',
  nav: 'menu',
  header: 'en-tête',
  footer: 'pied de page',
  section: 'section',
  article: 'article',
  form: 'formulaire',
  input: 'champ',
  textarea: 'champ',
  select: 'liste déroulante',
  label: 'libellé',
  figure: 'figure',
  table: 'tableau',
  blockquote: 'citation',
}

// Description lisible de l'élément pour le champ « zone » : bouton « Réserver »
export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const nom = /^h[1-6]$/.test(tag) ? 'titre' : (NOMS[tag] ?? 'bloc')
  const libelle = el.getAttribute('aria-label') || el.getAttribute('alt') || readText(el)
  const extrait = libelle.length > 60 ? `${libelle.slice(0, 57).trimEnd()}…` : libelle
  return extrait ? `${nom} « ${extrait} »` : nom
}
