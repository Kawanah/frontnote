// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNotes, type NoteLocale } from './notes'
import { mountOverlay } from './overlay'

let destroy: () => void = () => {}
const carnet = () => createNotes('demo', localStorage)

function mount(envoyer = vi.fn<(n: NoteLocale[]) => Promise<string[]>>()) {
  destroy = mountOverlay({ notes: carnet(), envoyer })
  return envoyer
}

const base = {
  selecteur: '#lien',
  x: 0.5,
  y: 0.5,
  type: 'bug' as const,
  appareil: 'mobile' as const,
  zone: 'lien',
  constat: 'x',
}

const shadow = () => (document.querySelector('frontnote-root') as HTMLElement).shadowRoot!
const $ = <T extends Element>(q: string) => shadow().querySelector(q) as T
const $$ = (q: string) => Array.from(shadow().querySelectorAll(q))

function clickPage(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }))
}

function ouvrir(envoyer?: Parameters<typeof mount>[0]) {
  const fn = mount(envoyer)
  $<HTMLButtonElement>('.toolbar').click()
  clickPage(document.getElementById('lien') as Element)
  return fn
}

// Formulaire de création (ancré au pin) ; celui de modification est dans le panneau
const garder = () => $<HTMLFormElement>('.root > .panel').requestSubmit()

// Widget déjà monté : passe en mode commentaire si besoin et garde un bug
function noteBug(constat = 'Le lien ne marche pas') {
  if ($('.toolbar').getAttribute('aria-pressed') !== 'true')
    $<HTMLButtonElement>('.toolbar').click()
  clickPage(document.getElementById('lien') as Element)
  $<HTMLInputElement>('input[value=bug]').click()
  $<HTMLTextAreaElement>('[name=constat]').value = constat
  garder()
}

beforeEach(() => {
  localStorage.clear()
  document.head.innerHTML = ''
  document.body.innerHTML = '<main><a href="/ailleurs" id="lien">Réserver   maintenant</a></main>'
})

afterEach(() => destroy())

describe('mode commentaire', () => {
  it('bloque le clic sur le site et ouvre le formulaire', () => {
    mount()
    const pageClick = vi.fn()
    const link = document.getElementById('lien') as Element
    link.addEventListener('click', pageClick)

    $<HTMLButtonElement>('.toolbar').click()
    expect($('.toolbar').getAttribute('aria-pressed')).toBe('true')

    clickPage(link)
    expect(pageClick).not.toHaveBeenCalled()
    expect($('.root > .panel')).not.toBeNull()
    expect($('.pin.draft').textContent).toBe('1')
  })

  it('laisse le site tranquille hors mode commentaire', () => {
    mount()
    const pageClick = vi.fn()
    const link = document.getElementById('lien') as Element
    link.addEventListener('click', (e) => {
      e.preventDefault()
      pageClick()
    })
    clickPage(link)
    expect(pageClick).toHaveBeenCalled()
    expect($('.panel')).toBeNull()
  })

  it('ouvre le panneau « Mes retours » qui se remplit au fur et à mesure', () => {
    ouvrir()
    expect($<HTMLElement>('.sidebar').hidden).toBe(false)
    expect($<HTMLElement>('[data-vide]').hidden).toBe(false)
  })
})

describe('brouillons', () => {
  it('type texte : garde le retour sans l’envoyer, texte mot pour mot', () => {
    const envoyer = ouvrir()
    expect($('[data-current]').textContent).toBe('Réserver maintenant')

    const nouveau = '  Réserver  « maintenant » ! '
    $<HTMLTextAreaElement>('[name=texte_attendu]').value = nouveau
    garder()

    expect(envoyer).not.toHaveBeenCalled()
    expect($('.root > .panel')).toBeNull()
    const [note] = carnet().lire().brouillons
    expect(note).toMatchObject({
      numero: 1,
      selecteur: '#lien',
      type: 'texte',
      appareil: 'ordinateur',
      zone: 'lien « Réserver maintenant »',
      texte_actuel: 'Réserver maintenant',
      texte_attendu: nouveau,
    })
    // Même numéro sur le pin, la carte et le compteur
    expect($('button.pin').textContent).toBe('1')
    expect($('.card .num').textContent).toBe('1')
    expect($('.badge').textContent).toBe('1')
    expect($('[data-envoyer]').textContent).toBe('Envoyer mon retour')
  })

  it('type texte : « Partir du texte actuel » recopie le texte à corriger', () => {
    ouvrir()
    const reprendre = $<HTMLButtonElement>('[data-reprendre]')
    const champ = $<HTMLTextAreaElement>('[name=texte_attendu]')
    expect(reprendre.hidden).toBe(false)
    reprendre.click()
    expect(champ.value).toBe('Réserver maintenant')

    // Recopié sans changement : rien à corriger, on le signale
    garder()
    expect($('.root > .panel .error').textContent).toContain('identique')
    expect(carnet().lire().brouillons).toEqual([])

    champ.value = 'Réserver dès maintenant '
    champ.dispatchEvent(new Event('input'))
    expect(reprendre.textContent).toBe('Remplacer par le texte actuel')
    garder()
    expect(carnet().lire().brouillons[0]!.texte_attendu).toBe('Réserver dès maintenant ')
  })

  it('élément sans texte : pas de bouton pour repartir du texte actuel', () => {
    document.body.innerHTML = '<main><img id="lien" alt=""></main>'
    ouvrir()
    expect($<HTMLButtonElement>('[data-reprendre]').hidden).toBe(true)
  })

  it('type couleur : constat, attendu, couleur et écran choisis', () => {
    ouvrir()
    $<HTMLInputElement>('input[value=couleur]').click()
    $<HTMLInputElement>('input[value=tous]').click()
    const swatch = $<HTMLInputElement>('[name=couleur]')
    swatch.value = '#e8590c'
    swatch.dispatchEvent(new Event('input'))
    $<HTMLTextAreaElement>('[name=constat]').value = '  trop clair  '
    $<HTMLTextAreaElement>('[name=attendu]').value = 'plus foncé'
    garder()

    const [note] = carnet().lire().brouillons
    expect(note).toMatchObject({
      type: 'couleur',
      appareil: 'tous',
      couleur: '#e8590c',
      constat: 'trop clair',
      attendu: 'plus foncé',
    })
    expect(note!.texte_attendu).toBeUndefined()
  })

  it("ne garde pas de couleur si le client n'en a pas choisi", () => {
    ouvrir()
    $<HTMLInputElement>('input[value=couleur]').click()
    $<HTMLTextAreaElement>('[name=constat]').value = 'à revoir'
    garder()
    expect(carnet().lire().brouillons[0]!.couleur).toBeUndefined()
  })

  it('refuse un retour incomplet', () => {
    ouvrir()
    garder() // type texte sans nouveau texte
    expect($<HTMLElement>('.root > .panel .error').hidden).toBe(false)

    $<HTMLInputElement>('input[value=bug]').click()
    garder() // bug sans constat
    expect(carnet().lire().brouillons).toEqual([])
  })

  it('retrouve ses pins en revenant sur la page', () => {
    mount()
    noteBug()
    destroy()
    mount()
    expect($('button.pin').textContent).toBe('1')
    expect($('.badge').textContent).toBe('1')
    expect($('.toast').textContent).toBe('Vous avez 1 retour à envoyer.')
  })

  it('modifie un retour depuis sa carte', () => {
    mount()
    noteBug('avant')
    ;($$('.card .link').find((b) => b.textContent === 'Modifier') as HTMLElement).click()

    const form = $<HTMLFormElement>('.sidebar .panel')
    expect(form.querySelector<HTMLTextAreaElement>('[name=constat]')!.value).toBe('avant')
    expect(form.querySelector('[data-numero]')!.textContent).toBe('1')
    form.querySelector<HTMLTextAreaElement>('[name=constat]')!.value = 'après'
    form.requestSubmit()

    expect(carnet().lire().brouillons[0]).toMatchObject({ numero: 1, constat: 'après' })
    expect($('.sidebar .panel')).toBeNull()
    expect($('.card-text').textContent).toBe('après')
  })

  it('supprime un retour après confirmation, sans renuméroter les autres', () => {
    mount()
    noteBug('un')
    noteBug('deux')
    const premiere = $$('.card')[0] as HTMLElement
    const bouton = (texte: string) =>
      Array.from(premiere.querySelectorAll('button')).filter((b) => b.textContent === texte)
    bouton('Supprimer')[0]!.click()
    expect(carnet().lire().brouillons).toHaveLength(2)
    bouton('Supprimer')[1]!.click()

    expect(
      carnet()
        .lire()
        .brouillons.map((n) => n.numero)
    ).toEqual([2])
    expect($$('button.pin').map((p) => p.textContent)).toEqual(['2'])
  })
})

describe('envoi du lot', () => {
  it('envoie tous les brouillons après confirmation ; ils passent en lecture seule', async () => {
    const envoyer = vi.fn().mockResolvedValue(['KAW-012', 'KAW-013'])
    destroy = mountOverlay({ notes: carnet(), envoyer })
    noteBug('un')
    noteBug('deux')

    $<HTMLButtonElement>('[data-envoyer]').click()
    expect($<HTMLElement>('[data-question]').textContent).toContain('Envoyer 2 retours')
    expect(envoyer).not.toHaveBeenCalled()
    $<HTMLButtonElement>('[data-oui]').click()

    await vi.waitFor(() => expect(carnet().lire().brouillons).toEqual([]))
    expect(envoyer.mock.calls[0]![0].map((n: NoteLocale) => n.constat)).toEqual(['un', 'deux'])
    expect(
      carnet()
        .lire()
        .envoyes.map((n) => n.id)
    ).toEqual(['KAW-012', 'KAW-013'])
    expect($$('.pin.sent')).toHaveLength(2)
    expect($('button.pin')).toBeNull()
    expect($<HTMLElement>('.badge').hidden).toBe(true)
    expect($('[data-envoyes] .card-meta').textContent).toContain('KAW-013')
  })

  it('erreur : message affiché, brouillons conservés', async () => {
    mount()
    noteBug()
    destroy()
    mount(vi.fn().mockRejectedValue(new Error('Connexion impossible')))
    $<HTMLButtonElement>('[data-envoyer]').click()
    $<HTMLButtonElement>('[data-oui]').click()

    await vi.waitFor(() => expect($('.sb-foot .error').textContent).toBe('Connexion impossible'))
    expect(carnet().lire().brouillons).toHaveLength(1)
  })
})

describe('sauvegarde et reprise', () => {
  it('affiche le lien de reprise et l’état de la sauvegarde', () => {
    let ecouteur: (etat: 'ok' | 'attente' | 'erreur') => void = () => {}
    destroy = mountOverlay({
      notes: carnet(),
      envoyer: vi.fn(),
      sauvegarde: { etat: 'ok', ecouter: (e) => ((ecouteur = e), () => {}) },
      lienReprise: () => 'https://a.fr/?frontnote=k&carnet=abc',
    })
    expect($<HTMLElement>('[data-reprise]').hidden).toBe(true) // carnet vide

    noteBug()
    expect($<HTMLElement>('[data-reprise]').hidden).toBe(false)
    expect($<HTMLInputElement>('[data-lien]').value).toBe('https://a.fr/?frontnote=k&carnet=abc')
    expect($('[data-attente]').textContent).toContain('Pas encore envoyés')

    ecouteur('erreur')
    expect($('[data-sauvegarde]').textContent).toContain('restent dans ce navigateur')
  })

  it('au-delà de 50 brouillons, demande d’envoyer d’abord', () => {
    const notes = carnet()
    for (let i = 0; i < 50; i++) notes.ajouter(base, location.href)
    mount()
    $<HTMLButtonElement>('.toolbar').click()
    clickPage(document.getElementById('lien') as Element)
    expect($('.root > .panel')).toBeNull()
    expect($('.toast').textContent).toContain('envoyez-les')
  })
})

it('se retire proprement', () => {
  mount()
  $<HTMLButtonElement>('.toolbar').click()
  destroy()
  expect(document.querySelector('frontnote-root')).toBeNull()
  expect(document.documentElement.classList.contains('frontnote-picking')).toBe(false)
})
