// Erreur métier : porte le code HTTP et un message lisible par l'humain ou l'agent
export class DomainError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}
