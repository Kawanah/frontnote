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

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = '<main><a href="/ailleurs" id="lien">Lien</a></main>'
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

  it('envoie le retour avec sélecteur, type et couleur', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    mount(submit)
    $<HTMLButtonElement>('.toolbar').click()
    clickPage(document.getElementById('lien') as Element)

    $<HTMLInputElement>('input[value=couleur]').click()
    const swatch = $<HTMLInputElement>('[name=color]')
    swatch.value = '#e8590c'
    swatch.dispatchEvent(new Event('input'))
    $<HTMLTextAreaElement>('textarea').value = '  plus foncé  '
    $<HTMLFormElement>('.panel').requestSubmit()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())

    expect(submit.mock.calls[0]![0]).toMatchObject({
      selector: '#lien',
      type: 'couleur',
      device: 'desktop',
      color: '#e8590c',
      message: 'plus foncé',
    })
    await vi.waitFor(() => expect($('.panel')).toBeNull())
    expect($('.pin:not(.draft)')).not.toBeNull()
  })

  it('se retire proprement', () => {
    mount(vi.fn())
    $<HTMLButtonElement>('.toolbar').click()
    destroy()
    expect(document.querySelector('frontnote-root')).toBeNull()
    expect(document.documentElement.classList.contains('frontnote-picking')).toBe(false)
  })

  it("n'envoie pas de couleur si le client n'en a pas choisi", async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    mount(submit)
    $<HTMLButtonElement>('.toolbar').click()
    clickPage(document.getElementById('lien') as Element)
    $<HTMLInputElement>('input[value=couleur]').click()
    $<HTMLTextAreaElement>('textarea').value = 'à revoir'
    $<HTMLFormElement>('.panel').requestSubmit()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())
    expect(submit.mock.calls[0]![0].color).toBeUndefined()
  })

  it("envoie l'écran choisi", async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    mount(submit)
    $<HTMLButtonElement>('.toolbar').click()
    clickPage(document.getElementById('lien') as Element)
    $<HTMLInputElement>('input[value=bug]').click()
    $<HTMLInputElement>('input[value=mobile]').click()
    $<HTMLTextAreaElement>('textarea').value = 'le formulaire ne part pas'
    $<HTMLFormElement>('.panel').requestSubmit()
    await vi.waitFor(() => expect(submit).toHaveBeenCalled())
    expect(submit.mock.calls[0]![0]).toMatchObject({ type: 'bug', device: 'mobile' })
  })

  it('refuse un message vide sans appeler l’API', () => {
    const submit = vi.fn()
    mount(submit)
    $<HTMLButtonElement>('.toolbar').click()
    clickPage(document.getElementById('lien') as Element)
    $<HTMLFormElement>('.panel').requestSubmit()
    expect(submit).not.toHaveBeenCalled()
    expect($<HTMLElement>('.error').hidden).toBe(false)
  })

  it('affiche l’erreur de l’API et garde le formulaire', async () => {
    mount(vi.fn().mockRejectedValue(new Error('Connexion impossible')))
    $<HTMLButtonElement>('.toolbar').click()
    clickPage(document.getElementById('lien') as Element)
    $<HTMLTextAreaElement>('textarea').value = 'texte'
    $<HTMLFormElement>('.panel').requestSubmit()
    await vi.waitFor(() => expect($('.error').textContent).toBe('Connexion impossible'))
    expect($('.panel')).not.toBeNull()
  })
})
