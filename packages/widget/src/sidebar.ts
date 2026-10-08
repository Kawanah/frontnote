// Panneau latéral « Mes retours » : les notes du client, numérotées comme leurs pins.
// Brouillons modifiables jusqu'à l'envoi du lot ; retours envoyés en lecture seule.
import { memePage, type Carnet, type NoteLocale } from './notes'
import type { EtatSauvegarde } from './sync'
import { APPAREIL_LABELS, TYPE_LABELS } from './types'

const SIDEBAR_HTML = `
  <header class="sb-head">
    <h2>Mes retours</h2>
    <button type="button" class="icon" data-close aria-label="Fermer le panneau">×</button>
  </header>
  <div class="sb-body" data-liste>
    <p class="sb-empty" data-vide>Cliquez sur « Commenter », puis sur l’élément de la page
      à corriger. Vos retours s’affichent ici au fur et à mesure.</p>
    <section data-brouillons hidden>
      <h3 data-titre-brouillons></h3>
      <div data-groupes></div>
    </section>
    <details data-envoyes hidden>
      <summary data-titre-envoyes></summary>
      <ol class="cards" data-liste-envoyes></ol>
    </details>
    <details class="reprise" data-reprise hidden>
      <summary>Retrouver mes retours sur un autre appareil</summary>
      <p class="sb-note">Gardez ce lien : il rouvre vos retours sur un autre ordinateur ou
        téléphone, même si ce navigateur les a oubliés.</p>
      <div class="copie">
        <input class="text" readonly data-lien aria-label="Lien de reprise">
        <button type="button" class="btn" data-copier>Copier</button>
      </div>
    </details>
  </div>
  <div class="sb-body" data-edition hidden></div>
  <footer class="sb-foot" data-pied hidden>
    <p class="error" role="alert" hidden></p>
    <div data-avant-envoi>
      <p class="sb-note strong" data-attente></p>
      <p class="sb-note" data-sauvegarde aria-live="polite"></p>
      <button type="button" class="btn primary wide" data-envoyer></button>
    </div>
    <div data-confirmation hidden>
      <p class="sb-note strong" data-question></p>
      <div class="actions">
        <button type="button" class="btn" data-non>Retour</button>
        <button type="button" class="btn primary" data-oui>Confirmer l’envoi</button>
      </div>
    </div>
  </footer>
`

export interface SidebarActions {
  pageCourante: () => string
  /** Note de la page courante dont l'élément est introuvable */
  introuvable: (note: NoteLocale) => boolean
  montrer: (note: NoteLocale) => void
  modifier: (note: NoteLocale) => void
  supprimer: (note: NoteLocale) => void
  envoyer: () => Promise<void>
  fermer: () => void
  lienReprise: () => string | null
}

const SAUVEGARDE: Record<EtatSauvegarde, string> = {
  ok: '✓ Sauvegardés en ligne : retrouvables avec votre lien de reprise.',
  attente: 'Sauvegarde…',
  erreur: 'Sauvegarde en ligne impossible pour l’instant : vos retours restent dans ce navigateur.',
}

// « Le plus ancien attend depuis 3 jours » : rappel pour ne pas oublier l'envoi
function attente(brouillons: NoteLocale[], maintenant = Date.now()): string {
  const base = 'Pas encore envoyés : l’agence ne les verra qu’après l’envoi.'
  const plusAncien = Math.min(...brouillons.map((n) => Date.parse(n.creeLe) || maintenant))
  const jours = Math.floor((maintenant - plusAncien) / 86_400_000)
  if (jours < 1) return base
  return `${base} Le plus ancien attend depuis ${jours} jour${jours > 1 ? 's' : ''}.`
}

function chemin(url: string): string {
  try {
    const { pathname, search } = new URL(url)
    return decodeURI(pathname + search)
  } catch {
    return url
  }
}

function extrait(note: NoteLocale): string {
  const texte = note.type === 'texte' ? note.texte_attendu : note.constat
  const ligne = (texte ?? '').replace(/\s+/g, ' ').trim()
  return ligne.length > 140 ? `${ligne.slice(0, 137).trimEnd()}…` : ligne
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = ''
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function bouton(text: string, className = 'link'): HTMLButtonElement {
  const node = el('button', className, text)
  node.type = 'button'
  return node
}

// Carte d'une note : numéro, type, écran, extrait (textContent : jamais d'HTML)
function carte(note: NoteLocale, id?: string): HTMLLIElement {
  const li = el('li', 'card')
  li.dataset.id = note.idLocal
  li.append(el('span', id ? 'num sent' : 'num', String(note.numero)))
  const corps = el('div', 'card-body')
  const meta = [id, TYPE_LABELS[note.type], APPAREIL_LABELS[note.appareil]].filter(Boolean)
  corps.append(el('p', 'card-meta', meta.join(' · ')))
  corps.append(el('p', 'card-text', extrait(note) || note.zone))
  li.append(corps)
  return li
}

export function createSidebar(actions: SidebarActions) {
  const aside = el('aside', 'sidebar')
  aside.setAttribute('aria-label', 'Mes retours')
  aside.hidden = true
  aside.innerHTML = SIDEBAR_HTML

  const q = <T extends Element>(sel: string) => aside.querySelector(sel) as T
  const liste = q<HTMLElement>('[data-liste]')
  const edition = q<HTMLElement>('[data-edition]')
  const vide = q<HTMLElement>('[data-vide]')
  const sectionBrouillons = q<HTMLElement>('[data-brouillons]')
  const titreBrouillons = q<HTMLElement>('[data-titre-brouillons]')
  const groupes = q<HTMLElement>('[data-groupes]')
  const sectionEnvoyes = q<HTMLDetailsElement>('[data-envoyes]')
  const titreEnvoyes = q<HTMLElement>('[data-titre-envoyes]')
  const listeEnvoyes = q<HTMLElement>('[data-liste-envoyes]')
  const pied = q<HTMLElement>('[data-pied]')
  const erreur = q<HTMLElement>('.error')
  const avantEnvoi = q<HTMLElement>('[data-avant-envoi]')
  const confirmation = q<HTMLElement>('[data-confirmation]')
  const question = q<HTMLElement>('[data-question]')
  const envoyer = q<HTMLButtonElement>('[data-envoyer]')
  const oui = q<HTMLButtonElement>('[data-oui]')
  const texteAttente = q<HTMLElement>('[data-attente]')
  const texteSauvegarde = q<HTMLElement>('[data-sauvegarde]')
  const reprise = q<HTMLElement>('[data-reprise]')
  const lien = q<HTMLInputElement>('[data-lien]')
  const copier = q<HTMLButtonElement>('[data-copier]')

  lien.addEventListener('focus', () => lien.select())
  copier.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lien.value)
      copier.textContent = 'Copié !'
    } catch {
      // presse-papiers refusé : le lien est sélectionné, à copier à la main
      lien.focus()
      copier.textContent = 'Copiez-le'
    }
    setTimeout(() => (copier.textContent = 'Copier'), 2000)
  })

  q<HTMLButtonElement>('[data-close]').addEventListener('click', actions.fermer)

  function confirmer(on: boolean) {
    avantEnvoi.hidden = on
    confirmation.hidden = !on
    erreur.hidden = true
    if (on) oui.focus()
  }

  envoyer.addEventListener('click', () => confirmer(true))
  q<HTMLButtonElement>('[data-non]').addEventListener('click', () => confirmer(false))
  oui.addEventListener('click', async () => {
    oui.disabled = true
    oui.textContent = 'Envoi…'
    try {
      await actions.envoyer()
      confirmer(false)
    } catch (err) {
      erreur.textContent =
        err instanceof Error ? err.message : "Les retours n'ont pas pu être envoyés."
      erreur.hidden = false
    } finally {
      oui.disabled = false
      oui.textContent = 'Confirmer l’envoi'
    }
  })

  // Carte de brouillon : clic = montrer sur la page ; Modifier ; Supprimer (confirmé sur place)
  function carteBrouillon(note: NoteLocale, surCettePage: boolean): HTMLLIElement {
    const li = carte(note)
    const corps = li.querySelector('.card-body') as HTMLElement
    if (surCettePage && actions.introuvable(note)) {
      corps.append(el('p', 'card-warn', 'Élément introuvable sur cette page'))
    }
    const actionsCarte = el('div', 'card-actions')
    const modifier = bouton('Modifier')
    const supprimer = bouton('Supprimer', 'link danger')
    actionsCarte.append(modifier, supprimer)
    const demande = el('div', 'card-actions ask')
    demande.hidden = true
    const confirmerSuppression = bouton('Supprimer', 'link danger')
    const non = bouton('Garder')
    demande.append(el('span', '', 'Supprimer ce retour ?'), confirmerSuppression, non)
    corps.append(actionsCarte, demande)

    if (surCettePage) {
      li.classList.add('clickable')
      li.addEventListener('click', (event) => {
        if ((event.target as Element).closest('button')) return
        actions.montrer(note)
      })
    }
    modifier.addEventListener('click', () => actions.modifier(note))
    supprimer.addEventListener('click', () => {
      actionsCarte.hidden = true
      demande.hidden = false
      non.focus()
    })
    non.addEventListener('click', () => {
      actionsCarte.hidden = false
      demande.hidden = true
    })
    confirmerSuppression.addEventListener('click', () => actions.supprimer(note))
    return li
  }

  function groupe(titre: string, notes: NoteLocale[], surCettePage: boolean, lien?: string) {
    const bloc = el('div', 'group')
    const h4 = el('h4')
    if (lien) {
      const a = el('a', '', chemin(lien))
      // Adresse relevée par le widget lui-même ; seuls les liens web sont rendus cliquables
      if (/^https?:/i.test(lien)) a.href = lien
      h4.append(a)
    } else {
      h4.textContent = titre
    }
    const ol = el('ol', 'cards')
    for (const note of notes) ol.append(carteBrouillon(note, surCettePage))
    bloc.append(h4, ol)
    return bloc
  }

  function afficher(carnet: Carnet, recent?: string) {
    const { brouillons } = carnet
    const page = actions.pageCourante()
    const ici = brouillons.filter((n) => memePage(n.url, page))
    const ailleurs = new Map<string, NoteLocale[]>()
    for (const note of brouillons) {
      if (memePage(note.url, page)) continue
      const cle = [...ailleurs.keys()].find((url) => memePage(url, note.url)) ?? note.url
      ailleurs.set(cle, [...(ailleurs.get(cle) ?? []), note])
    }

    groupes.replaceChildren()
    if (ici.length) groupes.append(groupe('Cette page', ici, true))
    if (ailleurs.size) {
      groupes.append(el('p', 'sb-sub', 'Autres pages'))
      for (const [url, notes] of ailleurs) groupes.append(groupe('', notes, false, url))
    }
    titreBrouillons.textContent = `À envoyer (${brouillons.length})`
    sectionBrouillons.hidden = brouillons.length === 0

    listeEnvoyes.replaceChildren(
      ...[...carnet.envoyes].reverse().map((note) => carte(note, note.id || 'Envoyé'))
    )
    titreEnvoyes.textContent = `Déjà envoyés (${carnet.envoyes.length})`
    sectionEnvoyes.hidden = carnet.envoyes.length === 0

    vide.hidden = brouillons.length > 0 || carnet.envoyes.length > 0
    pied.hidden = brouillons.length === 0
    if (brouillons.length) texteAttente.textContent = attente(brouillons)
    const url = actions.lienReprise()
    lien.value = url ?? ''
    reprise.hidden = !url || (!brouillons.length && !carnet.envoyes.length)
    const un = brouillons.length === 1
    envoyer.textContent = un ? 'Envoyer mon retour' : `Envoyer mes ${brouillons.length} retours`
    question.textContent = un
      ? 'Envoyer ce retour à l’agence ? Vous ne pourrez plus le modifier.'
      : `Envoyer ${brouillons.length} retours à l’agence ? Vous ne pourrez plus les modifier.`
    if (!brouillons.length) confirmer(false)

    if (recent) {
      const card = groupes.querySelector<HTMLElement>(`[data-id="${CSS.escape(recent)}"]`)
      card?.classList.add('recent')
      card?.scrollIntoView?.({ block: 'nearest' })
    }
  }

  return {
    element: aside,
    afficher,
    sauvegarde(etat: EtatSauvegarde) {
      texteSauvegarde.textContent = SAUVEGARDE[etat]
      texteSauvegarde.classList.toggle('warn', etat === 'erreur')
    },
    get ouvert() {
      return !aside.hidden
    },
    ouvrir() {
      aside.hidden = false
    },
    fermer() {
      aside.hidden = true
    },
    // Modification d'une note : le formulaire remplace la liste
    editer(form: HTMLFormElement) {
      edition.replaceChildren(form)
      liste.hidden = true
      pied.classList.add('masque')
      edition.hidden = false
      aside.hidden = false
    },
    finEdition() {
      edition.replaceChildren()
      edition.hidden = true
      liste.hidden = false
      pied.classList.remove('masque')
    },
    get enEdition() {
      return !edition.hidden
    },
  }
}

export type Sidebar = ReturnType<typeof createSidebar>
