// Contexte technique relevé automatiquement avec chaque retour (utile en recette)
export interface TechContext {
  userAgent: string
  language?: string
  viewport: { width: number; height: number }
  screen: { width: number; height: number }
  pixelRatio: number
  touch: boolean
}

export function collectContext(): TechContext {
  return {
    userAgent: navigator.userAgent.slice(0, 500),
    language: navigator.language?.slice(0, 35) || undefined,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: window.screen.width, height: window.screen.height },
    pixelRatio: Math.round(window.devicePixelRatio * 100) / 100,
    touch: navigator.maxTouchPoints > 0,
  }
}
