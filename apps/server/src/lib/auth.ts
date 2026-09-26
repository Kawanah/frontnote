import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value).digest()

// Vérifie l'en-tête « Authorization: Bearer <token> ».
// Sans token configuré, tout est refusé (fermé par défaut).
export function isAuthorized(header: string | null, token: string | undefined): boolean {
  if (!token || !header?.startsWith('Bearer ')) return false
  return timingSafeEqual(digest(header.slice('Bearer '.length)), digest(token))
}
