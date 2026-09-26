import { getClickPosition, getSelector, type Position } from './selector'
import { PAGE_STYLES, STYLES } from './styles'
import {
  COMMENT_TYPES,
  DEFAULT_PRIORITY,
  PRIORITIES,
  PRIORITY_LABELS,
  TYPE_LABELS,
  type CommentType,
  type Draft,
  type Priority,
} from './types'

const AUTHOR_KEY = 'frontnote:author'
const PICKING_CLASS = 'frontnote-picking'
const MOBILE_MAX = 480
const MARGIN = 16

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`

const PANEL_HTML = `
  <fieldset class="types">
    <legend>Type de retour</legend>
    ${COMMENT_TYPES.map(
      (type, i) => `<label class="type">
        <input type="radio" name="type" value="${type}"${i === 0 ? ' checked' : ''}>
        <span>${TYPE_LABELS[type]}</span>
      </label>`
    ).join('')}
  </fieldset>
  <fieldset class="types">
    <legend>Priorité</legend>
    ${PRIORITIES.map(
      (priority) => `<label class="type">
        <input type="radio" name="priority" value="${priority}"${
          priority === DEFAULT_PRIORITY ? ' checked' : ''
        }>
        <span>${PRIORITY_LABELS[priority]}</span>
      </label>`
    ).join('')}
  </fieldset>
  <label data-color hidden>
    <span class="label">Couleur souhaitée</span>
    <input class="swatch" type="color" name="color" value="#000000">
  </label>
  <label>
    <span class="label">Votre retour</span>
    <textarea name="message" maxlength="5000"
      placeholder="Ex. remplacer par la photo de l'équipe"></textarea>
  </label>
  <label>
    <span class="label">Votre prénom (facultatif)</span>
    <input class="text" name="author" maxlength="100" autocomplete="given-name">
  </label>
  <input class="honey" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
  <p class="error" role="alert" hidden></p>
  <div class="actions">
    <button type="button" class="btn" data-cancel>Annuler</button>
    <button type="submit" class="btn primary">Envoyer</button>
  </div>
`

// Événements de la page neutralisés pendant le mode commentaire
const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick']

interface Pin {
  element: Element
  position: Position
  node: HTMLElement
}

interface OpenDraft {
  pin: Pin
  panel: HTMLFormElement
}

function readAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveAuthor(author: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, author)
  } catch {
    // stockage indisponible : on redemandera le prénom
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

// Monte le widget ; renvoie une fonction qui le retire proprement
export function mountOverlay(submit: (draft: Draft) => Promise<void>): () => void {
  const listeners = new AbortController()
  const { signal } = listeners
  const host = document.createElement('frontnote-root')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>${STYLES}</style>
    <div class="root">
      <div class="highlight" hidden></div>
      <div class="pins"></div>
      <div class="toast" role="status" aria-live="polite" hidden></div>
      <button class="toolbar" type="button" aria-pressed="false">
        ${ICON}<span>Commenter</span>
      </button>
    </div>`
  document.body.append(host)

  const pageStyle = document.createElement('style')
  pageStyle.textContent = PAGE_STYLES
  document.head.append(pageStyle)

  const root = shadow.querySelector('.root') as HTMLElement
  const highlight = shadow.querySelector('.highlight') as HTMLElement
  const pinsLayer = shadow.querySelector('.pins') as HTMLElement
  const toast = shadow.querySelector('.toast') as HTMLElement
  const toolbar = shadow.querySelector('.toolbar') as HTMLButtonElement
  const toolbarLabel = toolbar.querySelector('span') as HTMLElement

  let picking = false
  let hovered: Element | null = null
  let draft: OpenDraft | null = null
  const pins: Pin[] = []
  let frame = 0
  let toastTimer = 0

  const isOurs = (event: Event) => event.composedPath().includes(host)

  // --- Rendu (positions recalculées à chaque scroll / resize) ---

  function pinPoint(pin: Pin) {
    const rect = pin.element.getBoundingClientRect()
    return {
      left: rect.left + pin.position.x * rect.width,
      top: rect.top + pin.position.y * rect.height,
      visible: pin.element.isConnected && (rect.width > 0 || rect.height > 0),
    }
  }

  function render() {
    frame = 0
    for (const pin of pins) {
      const { left, top, visible } = pinPoint(pin)
      pin.node.hidden = !visible
      pin.node.style.left = `${left}px`
      pin.node.style.top = `${top}px`
    }

    if (hovered && picking && !draft) {
      const rect = hovered.getBoundingClientRect()
      Object.assign(highlight.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      })
      highlight.hidden = false
    } else {
      highlight.hidden = true
    }

    if (draft) placePanel(draft)
  }

  const scheduleRender = () => {
    frame ||= requestAnimationFrame(render)
  }

  function placePanel({ pin, panel }: OpenDraft) {
    const mobile = window.innerWidth <= MOBILE_MAX
    panel.classList.toggle('sheet', mobile)
    if (mobile) return
    const { left, top } = pinPoint(pin)
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    // À droite du pin, ou à gauche s'il n'y a pas la place
    const x = left + 24 + width > window.innerWidth - MARGIN ? left - 24 - width : left + 24
    panel.style.left = `${clamp(x, MARGIN, window.innerWidth - width - MARGIN)}px`
    panel.style.top = `${clamp(top - 24, MARGIN, window.innerHeight - height - MARGIN)}px`
  }

  // --- Mode commentaire ---

  function setPicking(on: boolean) {
    picking = on
    toolbar.setAttribute('aria-pressed', String(on))
    toolbarLabel.textContent = on ? 'Terminer' : 'Commenter'
    document.documentElement.classList.toggle(PICKING_CLASS, on)
    if (!on) {
      hovered = null
      closeDraft()
    }
    scheduleRender()
  }

  function showToast(message: string) {
    toast.textContent = message
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.hidden = true), 3000)
  }

  // --- Pins et formulaire ---

  function addPin(element: Element, position: Position): Pin {
    const node = document.createElement('div')
    node.className = 'pin draft'
    node.textContent = String(pins.length + 1)
    pinsLayer.append(node)
    const pin = { element, position, node }
    pins.push(pin)
    return pin
  }

  function closeDraft(keepPin = false) {
    if (!draft) return
    const { pin, panel } = draft
    panel.remove()
    if (keepPin) {
      pin.node.classList.remove('draft')
    } else {
      pin.node.remove()
      pins.splice(pins.indexOf(pin), 1)
    }
    draft = null
    hovered = null
    scheduleRender()
  }

  function openDraft(element: Element, clientX: number, clientY: number) {
    const position = getClickPosition(element.getBoundingClientRect(), clientX, clientY)
    const selector = getSelector(element)
    const pin = addPin(element, position)

    const panel = document.createElement('form')
    panel.className = 'panel'
    panel.noValidate = true
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Nouveau retour')
    panel.innerHTML = PANEL_HTML
    root.append(panel)

    const field = <T extends Element>(q: string) => panel.querySelector(q) as T
    const colorField = field<HTMLElement>('[data-color]')
    const swatch = field<HTMLInputElement>('[name=color]')
    let colorChosen = false
    swatch.addEventListener('input', () => (colorChosen = true))
    const message = field<HTMLTextAreaElement>('textarea')
    const author = field<HTMLInputElement>('[name=author]')
    const error = field<HTMLElement>('.error')
    const send = field<HTMLButtonElement>('[type=submit]')
    author.value = readAuthor()

    panel.addEventListener('change', () => {
      colorField.hidden = new FormData(panel).get('type') !== 'couleur'
      placePanel(current)
    })
    field<HTMLButtonElement>('[data-cancel]').addEventListener('click', () => closeDraft())

    panel.addEventListener('submit', async (event) => {
      event.preventDefault()
      const data = new FormData(panel)
      const type = data.get('type') as CommentType
      const text = message.value.trim()
      if (!text) {
        error.textContent = "Écrivez votre retour avant de l'envoyer."
        error.hidden = false
        message.focus()
        return
      }

      send.disabled = true
      send.textContent = 'Envoi…'
      error.hidden = true
      const name = author.value.trim()
      try {
        await submit({
          selector,
          ...position,
          type,
          priority: data.get('priority') as Priority,
          message: text,
          color: type === 'couleur' && colorChosen ? swatch.value : undefined,
          author: name || undefined,
          _honey: String(data.get('_honey') ?? '') || undefined,
        })
        saveAuthor(name)
        closeDraft(true)
        showToast('Merci, votre retour est envoyé.')
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : "Le retour n'a pas pu être envoyé."
        error.hidden = false
        send.disabled = false
        send.textContent = 'Envoyer'
      }
    })

    const current: OpenDraft = { pin, panel }
    draft = current
    render()
    message.focus({ preventScroll: true })
    revealAboveSheet(current)
  }

  // Sur mobile, le formulaire occupe le bas de l'écran : on remonte la page
  // pour que l'élément commenté reste visible au-dessus
  function revealAboveSheet({ pin, panel }: OpenDraft) {
    if (window.innerWidth > MOBILE_MAX) return
    const visibleBottom = window.innerHeight - panel.offsetHeight - MARGIN
    const { top } = pinPoint(pin)
    if (top > visibleBottom - 40) {
      window.scrollBy({ top: top - visibleBottom / 2, behavior: 'smooth' })
    }
  }

  // --- Écouteurs (phase de capture : on passe avant les scripts du site) ---

  toolbar.addEventListener('click', () => setPicking(!picking), { signal })

  const block = (event: Event) => {
    if (!picking || isOurs(event)) return
    event.preventDefault()
    event.stopPropagation()
  }
  for (const type of BLOCKED_EVENTS) {
    window.addEventListener(type, block, { capture: true, signal })
  }

  window.addEventListener(
    'click',
    (event) => {
      if (!picking || isOurs(event)) return
      block(event)
      if (draft || !(event.target instanceof Element)) return
      openDraft(event.target, event.clientX, event.clientY)
    },
    { capture: true, signal }
  )

  window.addEventListener(
    'mousemove',
    (event) => {
      if (!picking || draft) return
      hovered = isOurs(event) || !(event.target instanceof Element) ? null : event.target
      scheduleRender()
    },
    { capture: true, passive: true, signal }
  )

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !picking) return
      event.stopPropagation()
      if (draft) closeDraft()
      else setPicking(false)
      toolbar.focus()
    },
    { capture: true, signal }
  )

  window.addEventListener('scroll', scheduleRender, { capture: true, passive: true, signal })
  window.addEventListener('resize', scheduleRender, { passive: true, signal })

  return () => {
    listeners.abort()
    cancelAnimationFrame(frame)
    clearTimeout(toastTimer)
    document.documentElement.classList.remove(PICKING_CLASS)
    host.remove()
    pageStyle.remove()
  }
}
