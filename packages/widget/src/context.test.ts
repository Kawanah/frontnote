// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { collectContext } from './context'

describe('collectContext', () => {
  it('relève navigateur, écran et fenêtre', () => {
    const context = collectContext()
    expect(context.userAgent).toBeTypeOf('string')
    expect(context.viewport.width).toBe(window.innerWidth)
    expect(context.screen.width).toBe(window.screen.width)
    expect(context.pixelRatio).toBeGreaterThan(0)
    expect(context.touch).toBeTypeOf('boolean')
  })
})
