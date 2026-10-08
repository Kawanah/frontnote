import {
  APPAREIL_LABELS,
  APPAREILS,
  COMMENT_TYPES,
  TYPE_LABELS,
  currentDevice,
  type Appareil,
  type CommentType,
  type Draft,
} from './types'

const AUTHOR_KEY = 'frontnote:author'

const FORM_HTML = `
  <p class="form-title"><span class="num" data-numero></span><span data-titre></span></p>
  <fieldset class="types">
    <legend>Type de retour</legend>
    ${COMMENT_TYPES.map(
      (type) => `<label class="type">
        <input type="radio" name="type" value="${type}">
        <span>${TYPE_LABELS[type]}</span>
      </label>`
    ).join('')}
  </fieldset>
  <fieldset class="types">
    <legend>Écran concerné</legend>
    ${APPAREILS.map(
      (appareil) => `<label class="type">
        <input type="radio" name="appareil" value="${appareil}">
        <span>${APPAREIL_LABELS[appareil]}</span>
      </label>`
    ).join('')}
  </fieldset>
  <label data-color hidden>
    <span class="label">Couleur souhaitée</span>
    <input class="swatch" type="color" name="couleur" value="#000000">
  </label>
  <div data-texte hidden>
    <span class="label">Texte actuel</span>
    <p class="current" data-current></p>
  </div>
  <label data-texte hidden>
    <span class="label">Nouveau texte, collé tel quel</span>
    <textarea name="texte_attendu" maxlength="10000"
      placeholder="Le texte exact à afficher à la place"></textarea>
  </label>
  <label>
    <span class="label" data-constat-label>Ce qui ne va pas</span>
    <textarea name="constat" maxlength="2000"
      placeholder="Ex. la photo est floue sur mobile"></textarea>
  </label>
  <label data-attendu>
    <span class="label">Ce que vous voulez à la place (facultatif)</span>
    <textarea name="attendu" maxlength="2000" rows="2"
      placeholder="Ex. la photo de l'équipe"></textarea>
  </label>
  <label>
    <span class="label">Votre prénom (facultatif)</span>
    <input class="text" name="auteur" maxlength="100" autocomplete="given-name">
  </label>
  <input class="honey" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">
  <p class="error" role="alert" hidden></p>
  <div class="actions">
    <button type="button" class="btn" data-cancel>Annuler</button>
    <button type="submit" class="btn primary" data-save></button>
  </div>
`

// Ce que le formulaire saisit ; l'ancrage (sélecteur, position, zone) vient de l'overlay
export type Saisie = Pick<
  Draft,
  | 'type'
  | 'appareil'
  | 'texte_actuel'
  | 'texte_attendu'
  | 'constat'
  | 'attendu'
  | 'couleur'
  | 'auteur'
  | '_honey'
>

export interface FormOptions {
  numero: number
  /** Texte relevé sur l'élément (ou gardé dans la note si l'élément n'est pas sur la page) */
  texteActuel: string
  /** Note existante : le formulaire sert à la modifier */
  initial?: Partial<Saisie>
  onSave: (saisie: Saisie) => void
  onCancel: () => void
}

function readAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveAuthor(author: string): void {
  try {
    localStorage.setItem(AUTHOR_KEY, author)
  } catch {
    // stockage indisponible : on redemandera le prénom
  }
}

export function createForm({
  numero,
  texteActuel,
  initial,
  onSave,
  onCancel,
}: FormOptions): HTMLFormElement {
  const panel = document.createElement('form')
  panel.className = 'panel'
  panel.noValidate = true
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', initial ? `Modifier le retour n° ${numero}` : 'Nouveau retour')
  panel.innerHTML = FORM_HTML

  const field = <T extends Element>(q: string) => panel.querySelector(q) as T
  const colorField = field<HTMLElement>('[data-color]')
  const swatch = field<HTMLInputElement>('[name=couleur]')
  let colorChosen = Boolean(initial?.couleur)
  swatch.addEventListener('input', () => (colorChosen = true))
  const texteBlocs = panel.querySelectorAll<HTMLElement>('[data-texte]')
  const texteAttendu = field<HTMLTextAreaElement>('[name=texte_attendu]')
  const constat = field<HTMLTextAreaElement>('[name=constat]')
  const constatLabel = field<HTMLElement>('[data-constat-label]')
  const attenduField = field<HTMLElement>('[data-attendu]')
  const attendu = field<HTMLTextAreaElement>('[name=attendu]')
  const author = field<HTMLInputElement>('[name=auteur]')
  const error = field<HTMLElement>('.error')

  field<HTMLElement>('[data-numero]').textContent = String(numero)
  field<HTMLElement>('[data-titre]').textContent = initial ? 'Modifier ce retour' : 'Nouveau retour'
  field<HTMLElement>('[data-save]').textContent = initial ? 'Enregistrer' : 'Garder ce retour'
  field<HTMLElement>('[data-current]').textContent = texteActuel || '(aucun texte sur cet élément)'

  const type: CommentType = initial?.type ?? COMMENT_TYPES[0]
  const appareil: Appareil = initial?.appareil ?? currentDevice()
  field<HTMLInputElement>(`[name=type][value=${type}]`).checked = true
  field<HTMLInputElement>(`[name=appareil][value=${appareil}]`).checked = true
  if (initial?.couleur) swatch.value = initial.couleur
  texteAttendu.value = initial?.texte_attendu ?? ''
  constat.value = initial?.constat ?? ''
  attendu.value = initial?.attendu ?? ''
  author.value = initial ? (initial.auteur ?? '') : readAuthor()

  const selectedType = () => new FormData(panel).get('type') as CommentType

  // Texte : texte actuel + nouveau texte ; autres types : constat + attendu
  function updateMode() {
    const texte = selectedType() === 'texte'
    texteBlocs.forEach((bloc) => (bloc.hidden = !texte))
    attenduField.hidden = texte
    colorField.hidden = selectedType() !== 'couleur'
    constatLabel.textContent = texte ? 'Commentaire (facultatif)' : 'Ce qui ne va pas'
  }
  updateMode()

  panel.addEventListener('change', updateMode)
  field<HTMLButtonElement>('[data-cancel]').addEventListener('click', onCancel)

  const showError = (text: string, focus: HTMLElement) => {
    error.textContent = text
    error.hidden = false
    focus.focus()
  }

  panel.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(panel)
    const type = selectedType()
    const texte = type === 'texte'
    // Texte du client repris mot pour mot : aucune retouche (contrat § 7.1)
    const nouveauTexte = texteAttendu.value
    const constatValue = constat.value.trim()

    if (texte && !nouveauTexte.trim()) {
      return showError('Collez le nouveau texte avant de continuer.', texteAttendu)
    }
    if (!texte && !constatValue) {
      return showError('Dites ce qui ne va pas avant de continuer.', constat)
    }

    error.hidden = true
    const name = author.value.trim()
    saveAuthor(name)
    onSave({
      type,
      appareil: data.get('appareil') as Appareil,
      texte_actuel: texte ? texteActuel : undefined,
      texte_attendu: texte ? nouveauTexte : undefined,
      constat: constatValue || undefined,
      attendu: (!texte && attendu.value.trim()) || undefined,
      couleur: type === 'couleur' && colorChosen ? swatch.value : undefined,
      auteur: name || undefined,
      _honey: String(data.get('_honey') ?? '') || undefined,
    })
  })

  return panel
}

// Premier champ à remplir selon le type choisi
export function focusForm(panel: HTMLFormElement): void {
  const texte = new FormData(panel).get('type') === 'texte'
  const champ = panel.querySelector(texte ? '[name=texte_attendu]' : '[name=constat]')
  ;(champ as HTMLElement | null)?.focus({ preventScroll: true })
}
