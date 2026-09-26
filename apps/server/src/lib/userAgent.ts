// Résumé lisible du navigateur : « Safari 18 · iOS 18 »
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
  [/SamsungBrowser\/(\d+)/, 'Samsung Internet'],
  [/(?:Firefox|FxiOS)\/(\d+)/, 'Firefox'],
  [/(?:Chrome|CriOS)\/(\d+)/, 'Chrome'],
  [/Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/, 'Safari'],
]

function browser(ua: string): string {
  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(ua)
    if (match) return `${name} ${match[1]}`
  }
  return 'Navigateur inconnu'
}

function system(ua: string): string {
  const ios = /(?:iPhone|iPad|iPod).*? OS (\d+)/.exec(ua)
  if (ios) return `iOS ${ios[1]}`
  const android = /Android (\d+)/.exec(ua)
  if (android) return `Android ${android[1]}`
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'système inconnu'
}

export const describeUserAgent = (ua: string): string => `${browser(ua)} · ${system(ua)}`
