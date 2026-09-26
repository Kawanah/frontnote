import { describe, expect, it } from 'vitest'
import { isAuthorized } from './auth'

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
