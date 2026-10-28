import { describe, expect, it } from 'vitest'
import { clientIp } from './http'

const requete = (xff?: string) =>
  new Request('https://frontnote.test/api/corrections/lot', {
    method: 'POST',
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  })

describe('clientIp', () => {
  it('prend l’adresse ajoutée par le proxy', () => {
    expect(clientIp(requete('203.0.113.7'), '127.0.0.1')).toBe('203.0.113.7')
  })

  it('ignore les adresses inventées par le client en tête de la liste', () => {
    expect(clientIp(requete('1.2.3.4, 5.6.7.8, 203.0.113.7'), '127.0.0.1')).toBe('203.0.113.7')
  })

  it('se rabat sur l’adresse de la connexion sans en-tête', () => {
    expect(clientIp(requete(), '127.0.0.1')).toBe('127.0.0.1')
    expect(clientIp(requete(' '), '127.0.0.1')).toBe('127.0.0.1')
  })
})
