// Horodatage ISO complet (UTC)
export const maintenant = () => new Date().toISOString()

// Date du jour à Paris, format AAAA-MM-JJ (contrat : date_signalement)
export const aujourdhui = (date = new Date()) =>
  new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(date)
