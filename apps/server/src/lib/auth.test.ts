import { describe, expect, it } from 'vitest'
import { isAuthorized, nouveauJeton, roleFor, sessionValide, valeurSession } from './auth'

describe('isAuthorized', () => {
  it('accepte le bon token', () => {
    expect(isAuthorized('Bearer secret', 'secret')).toBe(true)
  })

  it.each([
    ['mauvais token', 'Bearer autre', 'secret'],
    ['en-tête absent', null, 'secret'],
    ['schéma différent', 'Basic secret', 'secret'],
    ['aucun token configuré', 'Bearer ', undefined],
  ])('refuse : %s', (_label, header, token) => {
    expect(isAuthorized(header, token)).toBe(false)
  })
})

describe('roleFor', () => {
  it('distingue agence et agent', () => {
    const { jeton, empreinte } = nouveauJeton()
    expect(roleFor('Bearer agence', 'agence', empreinte)).toBe('agence')
    expect(roleFor(`Bearer ${jeton}`, 'agence', empreinte)).toBe('agent')
    expect(roleFor(`Bearer ${jeton}`, 'agence', null)).toBeNull()
    expect(roleFor('Bearer autre', 'agence', empreinte)).toBeNull()
  })
})

describe('session du dashboard', () => {
  it('valide le cookie dérivé du jeton agence', () => {
    expect(sessionValide(valeurSession('secret'), 'secret')).toBe(true)
    expect(sessionValide(valeurSession('autre'), 'secret')).toBe(false)
    expect(sessionValide(undefined, 'secret')).toBe(false)
    expect(sessionValide(valeurSession('secret'), undefined)).toBe(false)
  })
})
