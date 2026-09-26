import { createRateLimiter } from './rateLimit'

// Limiteurs partagés (un module est chargé une fois ; une page Astro à chaque requête)
export const limiteSignalements = createRateLimiter({ limit: 30, windowMs: 10 * 60_000 })
export const limiteConnexion = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 })
