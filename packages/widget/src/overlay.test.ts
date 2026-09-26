// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountOverlay } from './overlay'

let destroy: () => void = () => {}
const mount = (submit: Parameters<typeof mountOverlay>[0]) => (destroy = mountOverlay(submit))

const shadow = () => (document.querySelector('frontnote-root') as HTMLElement).shadowRoot!
const $ = <T extends Element>(q: string) => shadow().querySelector(q) as T

function clickPage(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }))
}

function ouvrir(submit = vi.fn().mockResolvedValue(undefined)) {
  mount(submit)
  $<HTMLButtonElement>('.toolbar').click()
  clickPage(document.getElementById('lien') as Element)
  return submit
}

const envoyer = () => $<HTMLFormElement>('.panel').requestSubmit()

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = '<main><a href="/ailleurs" id="lien">Réserver   maintenant</a></main>'
})

afterEach(() => destroy())

describe('mountOverlay', () => {
  it('bloque le clic sur le site et ouvre le formulaire', () => {
    mount(vi.fn())
    const pageClick = vi.fn()
    const link = document.getElementById('lien') as Element
    link.addEventListener('click', pageClick)

    $<HTMLButtonElement>('.toolbar').click()
    expect($('.toolbar').getAttribute('aria-pressed')).toBe('true')

    clickPage(link)
    expect(pageClick).not.toHaveBeenCalled()
    expect($('.panel')).not.toBeNull()
    expect($('.pin.draft')).not.toBeNull()
  })

  it('laisse le site tranquille hors mode commentaire', () => {
    mount(vi.fn())
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

  it('type texte : relève le texte actuel et garde le nouveau mot pour mot', async () => {
    const submit = ouvrir()
    expect($('[data-current]').textContent).toBe('Réserver maintenant')

    const nouveau = '  Réserver  « maintenant » ! '
    $<HTMLTextAreaElement>('[name=texte_attendu]').value = nouveau
    envoyer()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())

    expect(submit.mock.calls[0]![0]).toMatchObject({
      selecteur: '#lien',
      type: 'texte',
      appareil: 'ordinateur',
      zone: 'lien « Réserver maintenant »',
      texte_actuel: 'Réserver maintenant',
      texte_attendu: nouveau,
    })
    await vi.waitFor(() => expect($('.panel')).toBeNull())
    expect($('.pin:not(.draft)')).not.toBeNull()
  })

  it('type couleur : constat, attendu, couleur et écran choisis', async () => {
    const submit = ouvrir()
    $<HTMLInputElement>('input[value=couleur]').click()
    $<HTMLInputElement>('input[value=tous]').click()
    const swatch = $<HTMLInputElement>('[name=couleur]')
    swatch.value = '#e8590c'
    swatch.dispatchEvent(new Event('input'))
    $<HTMLTextAreaElement>('[name=constat]').value = '  trop clair  '
    $<HTMLTextAreaElement>('[name=attendu]').value = 'plus foncé'
    envoyer()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())

    const draft = submit.mock.calls[0]![0]
    expect(draft).toMatchObject({
      type: 'couleur',
      appareil: 'tous',
      couleur: '#e8590c',
      constat: 'trop clair',
      attendu: 'plus foncé',
    })
    expect(draft.texte_attendu).toBeUndefined()
  })

  it("n'envoie pas de couleur si le client n'en a pas choisi", async () => {
    const submit = ouvrir()
    $<HTMLInputElement>('input[value=couleur]').click()
    $<HTMLTextAreaElement>('[name=constat]').value = 'à revoir'
    envoyer()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())
    expect(submit.mock.calls[0]![0].couleur).toBeUndefined()
  })

  it('refuse un envoi incomplet sans appeler l’API', () => {
    const submit = ouvrir(vi.fn())
    envoyer() // type texte sans nouveau texte
    expect($<HTMLElement>('.error').hidden).toBe(false)

    $<HTMLInputElement>('input[value=bug]').click()
    envoyer() // bug sans constat
    expect(submit).not.toHaveBeenCalled()
  })

  it('affiche l’erreur de l’API et garde le formulaire', async () => {
    ouvrir(vi.fn().mockRejectedValue(new Error('Connexion impossible')))
    $<HTMLTextAreaElement>('[name=texte_attendu]').value = 'texte'
    envoyer()
    await vi.waitFor(() => expect($('.error').textContent).toBe('Connexion impossible'))
    expect($('.panel')).not.toBeNull()
  })

  it('se retire proprement', () => {
    mount(vi.fn())
    $<HTMLButtonElement>('.toolbar').click()
    destroy()
    expect(document.querySelector('frontnote-root')).toBeNull()
    expect(document.documentElement.classList.contains('frontnote-picking')).toBe(false)
  })
})
