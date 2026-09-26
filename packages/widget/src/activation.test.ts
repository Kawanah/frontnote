import { describe, expect, it } from 'vitest'
import { resolveActivation } from './activation'

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
    expect(resolveActivation('coress', '', memoryStorage())).toBe(false)
  })

  it('active et mémorise via ?frontnote=<projet>', () => {
    const storage = memoryStorage()
    expect(resolveActivation('coress', '?frontnote=coress', storage)).toBe(true)
    expect(resolveActivation('coress', '', storage)).toBe(true)
  })

  it('ignore un lien destiné à un autre projet', () => {
    expect(resolveActivation('coress', '?frontnote=autre', memoryStorage())).toBe(false)
  })

  it('désactive via ?frontnote=off', () => {
    const storage = memoryStorage()
    resolveActivation('coress', '?frontnote=coress', storage)
    expect(resolveActivation('coress', '?frontnote=off', storage)).toBe(false)
    expect(resolveActivation('coress', '', storage)).toBe(false)
  })
})
