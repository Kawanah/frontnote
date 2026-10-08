import { pageUrl } from './api'
import { collectContext } from './context'
import { createForm, focusForm } from './form'
import { BROUILLONS_MAX, memePage, type NoteLocale, type NotesStore } from './notes'
import { describeElement, getClickPosition, getSelector, readText, type Position } from './selector'
import { createSidebar } from './sidebar'
import { PAGE_STYLES, STYLES } from './styles'
import type { EtatSauvegarde } from './sync'

const PICKING_CLASS = 'frontnote-picking'
const MOBILE_MAX = 480
const MARGIN = 16
const SIDEBAR_WIDTH = 360
// Navigation sans rechargement (Astro, Next) : on surveille l'adresse
const TICK_MS = 500

const ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`

// Événements de la page neutralisés pendant le mode commentaire
const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick']

export interface OverlayOptions {
  notes: NotesStore
  /** Envoie le lot de brouillons ; renvoie les identifiants du serveur dans l'ordre */
  envoyer: (brouillons: NoteLocale[]) => Promise<string[]>
  /** Copie serveur du carnet : son état s'affiche dans le panneau */
  sauvegarde?: {
    readonly etat: EtatSauvegarde
    ecouter: (ecouteur: (etat: EtatSauvegarde) => void) => () => void
  }
  /** Lien qui rouvre ce carnet sur un autre appareil */
  lienReprise?: () => string | null
}

// Pin d'une note du carnet présente sur cette page
interface Pin {
  note: NoteLocale
  element: Element
  node: HTMLElement
}

// Retour en cours de création, pas encore gardé
interface Creation {
  element: Element
  position: Position
  node: HTMLElement
  panel: HTMLFormElement
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

const isMobile = () => window.innerWidth <= MOBILE_MAX

function trouver(selecteur: string): Element | null {
  try {
    return document.querySelector(selecteur)
  } catch {
    return null
  }
}

// Monte le widget ; renvoie une fonction qui le retire proprement
export function mountOverlay({
  notes,
  envoyer,
  sauvegarde,
  lienReprise = () => null,
}: OverlayOptions): () => void {
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
      <div class="bar">
        <button class="mine" type="button" aria-expanded="false">
          <span>Mes retours</span><span class="badge" hidden></span>
        </button>
        <button class="toolbar" type="button" aria-pressed="false">
          ${ICON}<span>Commenter</span>
        </button>
      </div>
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
  const mine = shadow.querySelector('.mine') as HTMLButtonElement
  const badge = shadow.querySelector('.badge') as HTMLElement

  let picking = false
  let hovered: Element | null = null
  let creation: Creation | null = null
  let pins: Pin[] = []
  let introuvables = new Set<string>()
  let href = window.location.href
  let frame = 0
  let toastTimer = 0

  const pageCourante = () => pageUrl(window.location.href)
  const isOurs = (event: Event) => event.composedPath().includes(host)

  const sidebar = createSidebar({
    pageCourante,
    introuvable: (note) => introuvables.has(note.idLocal),
    montrer,
    modifier: editer,
    supprimer(note) {
      notes.supprimer(note.idLocal)
      refresh()
      showToast(`Retour n° ${note.numero} supprimé.`)
    },
    envoyer: envoyerTout,
    fermer: () => setSidebar(false),
    lienReprise,
  })
  root.append(sidebar.element)
  const arreterEcoute = sauvegarde?.ecouter((etat) => sidebar.sauvegarde(etat))
  if (sauvegarde) sidebar.sauvegarde(sauvegarde.etat)

  // --- Rendu (positions recalculées à chaque scroll / resize) ---

  function pinPoint(element: Element, position: Position) {
    const rect = element.getBoundingClientRect()
    return {
      left: rect.left + position.x * rect.width,
      top: rect.top + position.y * rect.height,
      visible: element.isConnected && (rect.width > 0 || rect.height > 0),
    }
  }

  function placeNode(node: HTMLElement, element: Element, position: Position) {
    const { left, top, visible } = pinPoint(element, position)
    node.hidden = !visible
    node.style.left = `${left}px`
    node.style.top = `${top}px`
  }

  function render() {
    frame = 0
    for (const pin of pins) placeNode(pin.node, pin.element, pin.note)
    if (creation) {
      placeNode(creation.node, creation.element, creation.position)
      placePanel(creation)
    }

    if (hovered && picking && !creation) {
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
  }

  const scheduleRender = () => {
    frame ||= requestAnimationFrame(render)
  }

  function placePanel({ element, position, panel }: Creation) {
    const mobile = isMobile()
    panel.classList.toggle('sheet', mobile)
    if (mobile) return
    const { left, top } = pinPoint(element, position)
    // Le panneau latéral ouvert réduit la place disponible à droite
    const right = window.innerWidth - (sidebar.ouvert ? SIDEBAR_WIDTH : 0) - MARGIN
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    // À droite du pin, ou à gauche s'il n'y a pas la place
    const x = left + 24 + width > right ? left - 24 - width : left + 24
    panel.style.left = `${clamp(x, MARGIN, right - width)}px`
    panel.style.top = `${clamp(top - 24, MARGIN, window.innerHeight - height - MARGIN)}px`
  }

  // --- Carnet : pins de la page, panneau, compteur ---

  function syncPins() {
    const carnet = notes.lire()
    const page = pageCourante()
    pinsLayer.replaceChildren()
    pins = []
    introuvables = new Set()

    const placer = (note: NoteLocale, envoye: boolean) => {
      if (!memePage(note.url, page)) return
      const element = trouver(note.selecteur)
      if (!element) {
        introuvables.add(note.idLocal)
        return
      }
      const node = document.createElement(envoye ? 'div' : 'button')
      node.className = envoye ? 'pin sent' : 'pin'
      node.textContent = String(note.numero)
      if (envoye) {
        node.title = `Retour n° ${note.numero} envoyé`
      } else {
        const bouton = node as HTMLButtonElement
        bouton.type = 'button'
        bouton.setAttribute('aria-label', `Modifier le retour n° ${note.numero}`)
        bouton.addEventListener('click', () => editer(note))
      }
      pinsLayer.append(node)
      pins.push({ note, element, node })
    }
    carnet.envoyes.forEach((note) => placer(note, true))
    carnet.brouillons.forEach((note) => placer(note, false))
    scheduleRender()
  }

  function refresh(recent?: string) {
    syncPins()
    const carnet = notes.lire()
    sidebar.afficher(carnet, recent)
    const n = carnet.brouillons.length
    badge.textContent = String(n)
    badge.hidden = n === 0
    mine.setAttribute(
      'aria-label',
      n ? `Mes retours, ${pluriel(n, 'retour')} à envoyer` : 'Mes retours'
    )
  }

  function setSidebar(open: boolean) {
    if (open) sidebar.ouvrir()
    else {
      if (sidebar.enEdition) sidebar.finEdition()
      sidebar.fermer()
    }
    mine.setAttribute('aria-expanded', String(open))
    root.classList.toggle('sb-open', open)
    scheduleRender()
  }

  // --- Mode commentaire ---

  function setPicking(on: boolean) {
    picking = on
    toolbar.setAttribute('aria-pressed', String(on))
    toolbarLabel.textContent = on ? 'Terminer' : 'Commenter'
    document.documentElement.classList.toggle(PICKING_CLASS, on)
    if (on) {
      if (sidebar.enEdition) sidebar.finEdition()
      // Sur ordinateur, le panneau se remplit sous les yeux du client ;
      // sur mobile il couvrirait la page : on le referme pour viser
      setSidebar(!isMobile())
    } else {
      hovered = null
      closeCreation()
    }
    scheduleRender()
  }

  function showToast(message: string) {
    toast.textContent = message
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.hidden = true), 3000)
  }

  // --- Création, modification, envoi ---

  function closeCreation() {
    if (!creation) return
    creation.panel.remove()
    creation.node.remove()
    creation = null
    hovered = null
    scheduleRender()
  }

  function openCreation(element: Element, clientX: number, clientY: number) {
    if (notes.lire().brouillons.length >= BROUILLONS_MAX) {
      showToast(`${BROUILLONS_MAX} retours en attente : envoyez-les avant d’en ajouter.`)
      return
    }
    const position = getClickPosition(element.getBoundingClientRect(), clientX, clientY)
    const selecteur = getSelector(element)
    const numero = notes.lire().prochainNumero

    const node = document.createElement('div')
    node.className = 'pin draft'
    node.textContent = String(numero)
    pinsLayer.append(node)

    const panel = createForm({
      numero,
      texteActuel: readText(element),
      onCancel: closeCreation,
      onSave(saisie) {
        const note = notes.ajouter(
          { selecteur, ...position, zone: describeElement(element), ...saisie },
          pageCourante(),
          collectContext()
        )
        closeCreation()
        refresh(note.idLocal)
        showToast(`Retour n° ${note.numero} gardé. Envoyez-les quand vous avez fini.`)
      },
    })
    panel.addEventListener('change', () => creation && placePanel(creation))
    root.append(panel)

    creation = { element, position, node, panel }
    render()
    focusForm(panel)
    revealAboveSheet(creation)
  }

  // Sur mobile, le formulaire occupe le bas de l'écran : on remonte la page
  // pour que l'élément commenté reste visible au-dessus
  function revealAboveSheet({ element, position, panel }: Creation) {
    if (!isMobile()) return
    const visibleBottom = window.innerHeight - panel.offsetHeight - MARGIN
    const { top } = pinPoint(element, position)
    if (top > visibleBottom - 40) {
      window.scrollBy({ top: top - visibleBottom / 2, behavior: 'smooth' })
    }
  }

  function editer(note: NoteLocale) {
    closeCreation()
    if (picking) setPicking(false)
    const element = memePage(note.url, pageCourante()) ? trouver(note.selecteur) : null
    const form = createForm({
      numero: note.numero,
      texteActuel: note.texte_actuel ?? (element ? readText(element) : ''),
      initial: note,
      onCancel: () => sidebar.finEdition(),
      onSave(saisie) {
        notes.modifier(note.idLocal, saisie)
        sidebar.finEdition()
        refresh(note.idLocal)
        showToast(`Retour n° ${note.numero} modifié.`)
      },
    })
    sidebar.editer(form)
    setSidebar(true)
    focusForm(form)
  }

  // Clic sur une carte : l'élément revient à l'écran et son pin clignote
  function montrer(note: NoteLocale) {
    const pin = pins.find((p) => p.note.idLocal === note.idLocal)
    if (!pin) return
    pin.element.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    pin.node.classList.remove('flash')
    void pin.node.offsetWidth // relance l'animation
    pin.node.classList.add('flash')
    if (isMobile()) setSidebar(false)
  }

  async function envoyerTout() {
    const lot = notes.lire().brouillons
    if (!lot.length) return
    const ids = await envoyer(lot)
    notes.marquerEnvoyes(lot, ids)
    refresh()
    showToast(
      lot.length > 1
        ? `Merci, vos ${lot.length} retours sont envoyés.`
        : 'Merci, votre retour est envoyé.'
    )
  }

  // Changement de page sans rechargement, ou éléments affichés après coup
  function tick() {
    // Certains sites remplacent tout le <body> en changeant de page
    if (!host.isConnected) document.body.append(host)
    if (!pageStyle.isConnected) document.head.append(pageStyle)
    if (window.location.href !== href) {
      href = window.location.href
      closeCreation()
      refresh()
    } else if (introuvables.size && [...introuvables].some(retrouvable)) {
      refresh()
    }
  }

  function retrouvable(idLocal: string) {
    const note = notes.lire().brouillons.find((n) => n.idLocal === idLocal)
    return note ? trouver(note.selecteur) !== null : false
  }

  // --- Écouteurs (phase de capture : on passe avant les scripts du site) ---

  toolbar.addEventListener('click', () => setPicking(!picking), { signal })
  mine.addEventListener('click', () => setSidebar(!sidebar.ouvert), { signal })

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
      if (creation || !(event.target instanceof Element)) return
      openCreation(event.target, event.clientX, event.clientY)
    },
    { capture: true, signal }
  )

  window.addEventListener(
    'mousemove',
    (event) => {
      if (!picking || creation) return
      hovered = isOurs(event) || !(event.target instanceof Element) ? null : event.target
      scheduleRender()
    },
    { capture: true, passive: true, signal }
  )

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return
      if (creation) closeCreation()
      else if (sidebar.enEdition) sidebar.finEdition()
      else if (picking) setPicking(false)
      else if (sidebar.ouvert) setSidebar(false)
      else return
      event.stopPropagation()
      toolbar.focus()
    },
    { capture: true, signal }
  )

  // Un autre onglet du même site a modifié le carnet
  window.addEventListener('storage', (event) => event.key === notes.key && refresh(), { signal })
  window.addEventListener('popstate', tick, { signal })
  window.addEventListener('scroll', scheduleRender, { capture: true, passive: true, signal })
  window.addEventListener('resize', scheduleRender, { passive: true, signal })
  const ticker = window.setInterval(tick, TICK_MS)

  refresh()
  const restants = notes.lire().brouillons.length
  if (restants) showToast(`Vous avez ${pluriel(restants, 'retour')} à envoyer.`)

  return () => {
    listeners.abort()
    arreterEcoute?.()
    clearInterval(ticker)
    cancelAnimationFrame(frame)
    clearTimeout(toastTimer)
    document.documentElement.classList.remove(PICKING_CLASS)
    host.remove()
    pageStyle.remove()
  }
}
