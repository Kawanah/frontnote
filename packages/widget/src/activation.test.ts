import { describe, expect, it } from 'vitest'
import {
  adresseSansActivation,
  forgetActivation,
  rememberActivation,
  resolveActivation,
} from './activation'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  }
}

describe('resolveActivation', () => {
  it('reste inactif sans lien ni mémoire', () => {
    expect(resolveActivation('coress', '', memoryStorage())).toBeNull()
  })

  it('propose la clé du lien ?frontnote=<clé>, sans la mémoriser avant validation', () => {
    const storage = memoryStorage()
    expect(resolveActivation('coress', '?frontnote=8f3a2c', storage)).toBe('8f3a2c')
    expect(resolveActivation('coress', '', storage)).toBeNull()
  })

  it('reprend la clé mémorisée après validation par le serveur', () => {
    const storage = memoryStorage()
    rememberActivation('coress', '8f3a2c', storage)
    expect(resolveActivation('coress', '', storage)).toBe('8f3a2c')
  })

  it('désactive via ?frontnote=off', () => {
    const storage = memoryStorage()
    rememberActivation('coress', '8f3a2c', storage)
    expect(resolveActivation('coress', '?frontnote=off', storage)).toBeNull()
    expect(resolveActivation('coress', '', storage)).toBeNull()
  })

  it('oublie l’activation refusée (projet clos, clé périmée)', () => {
    const storage = memoryStorage()
    rememberActivation('coress', '8f3a2c', storage)
    forgetActivation('coress', storage)
    expect(resolveActivation('coress', '', storage)).toBeNull()
  })

  it('ignore et efface l’ancienne activation par le nom du projet', () => {
    const storage = memoryStorage()
    storage.setItem('frontnote:active:coress', '1')
    expect(resolveActivation('coress', '', storage)).toBeNull()
    expect(storage.getItem('frontnote:active:coress')).toBeNull()
  })
})

describe('adresseSansActivation', () => {
  it('retire la clé et le carnet, garde le reste de l’adresse', () => {
    expect(
      adresseSansActivation('https://coress.fr/equipe?tab=2&frontnote=8f3a2c&carnet=abc#bas')
    ).toBe('https://coress.fr/equipe?tab=2#bas')
  })

  it('retire aussi ?frontnote=off', () => {
    expect(adresseSansActivation('https://coress.fr/?frontnote=off')).toBe('https://coress.fr/')
  })

  it('ne touche pas une adresse sans paramètre du widget', () => {
    expect(adresseSansActivation('https://coress.fr/equipe?tab=2#bas')).toBeNull()
  })
})
