import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  it('bloque au-delà de la limite puis repart après la fenêtre', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 })
    expect(allow('ip', 0)).toBe(true)
    expect(allow('ip', 10)).toBe(true)
    expect(allow('ip', 20)).toBe(false)
    expect(allow('autre-ip', 20)).toBe(true)
    expect(allow('ip', 1000)).toBe(true)
  })
})
