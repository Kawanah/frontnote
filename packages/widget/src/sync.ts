// Copie du carnet sur le serveur FrontNote : les brouillons survivent à un cache
// vidé et suivent le client d'un appareil à l'autre grâce au lien de reprise.
import { base } from './api'
import { carnetIdValide, type Carnet, type NotesStore } from './notes'

export type EtatSauvegarde = 'ok' | 'attente' | 'erreur'

// Regroupe les changements rapprochés en une seule écriture
const DELAI_MS = 1000

export interface SyncOptions {
  apiUrl: string
  projet: string
  cle: string
  notes: () => NotesStore
}

export type Sync = ReturnType<typeof createSync>

export function createSync({ apiUrl, projet, cle, notes }: SyncOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let etat: EtatSauvegarde = 'ok'
  const ecouteurs = new Set<(etat: EtatSauvegarde) => void>()

  const adresse = (id: string) => `${base(apiUrl)}/api/carnets/${encodeURIComponent(id)}`

  function changer(nouvel: EtatSauvegarde) {
    etat = nouvel
    ecouteurs.forEach((ecouteur) => ecouteur(nouvel))
  }

  async function pousser(): Promise<void> {
    timer = undefined
    const { id, ...carnet } = notes().lire()
    if (!id) return
    try {
      const response = await fetch(adresse(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projet, cle, carnet }),
      })
      // Un autre changement a pu arriver pendant l'envoi : il repartira
      if (!timer) changer(response.ok ? 'ok' : 'erreur')
    } catch {
      if (!timer) changer('erreur')
    }
  }

  // null : carnet absent du serveur ou serveur injoignable
  async function telecharger(id: string): Promise<Carnet | null> {
    try {
      const params = new URLSearchParams({ projet, cle })
      const response = await fetch(`${adresse(id)}?${params}`)
      if (!response.ok) return null
      const { carnet } = (await response.json()) as { carnet?: Carnet }
      return carnet ? { ...carnet, id } : null
    } catch {
      return null
    }
  }

  return {
    get etat() {
      return etat
    },

    ecouter(ecouteur: (etat: EtatSauvegarde) => void): () => void {
      ecouteurs.add(ecouteur)
      return () => ecouteurs.delete(ecouteur)
    },

    planifier(): void {
      changer('attente')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void pousser(), DELAI_MS)
    },

    // Au chargement : la copie la plus récente l'emporte. lien = ?carnet= du lien de reprise.
    async recuperer(lien: string | null): Promise<void> {
      const local = notes().lire()
      const viaLien = carnetIdValide(lien) && lien !== local.id
      const id = viaLien ? lien : local.id
      if (!id) return

      const distant = await telecharger(id)
      if (viaLien) {
        if (distant) notes().fusionner({ ...distant, id })
        return
      }
      if (!distant) {
        // Jamais sauvegardé (serveur injoignable jusqu'ici) : on rattrape
        if (local.brouillons.length || local.envoyes.length) this.planifier()
        return
      }
      const plusRecent = (distant.majLe ?? '') > (local.majLe ?? '')
      if (plusRecent) notes().remplacer(distant)
      else if ((local.majLe ?? '') > (distant.majLe ?? '')) this.planifier()
    },
  }
}
