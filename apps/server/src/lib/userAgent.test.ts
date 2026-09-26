import { describe, expect, it } from 'vitest'
import { describeUserAgent } from './userAgent'

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      'Safari 18 · iOS 18',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'Chrome 131 · Android 14',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Edge 131 · Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Firefox 132 · macOS',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'Safari 18 · macOS',
    ],
    ['curl/8.0', 'Navigateur inconnu · système inconnu'],
  ])('%s', (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected)
  })
})
