// Interrogazione periodica della revisione: aggiorna le viste quando un altro
// dispositivo modifica i dati (SPEC §12.6).
import type { QueryClient } from '@tanstack/react-query'
import { aggiornaRevisione, revisioneCorrente } from '@/api/client'
import { SchemaRevisione } from '@/contratto/comune.ts'
import { quandoTorna, segnalaEsito, segnalaSessionePersa, statoConnessione } from './stato'

export const INTERVALLO_REVISIONE_MS = 10_000

export async function controllaRevisione(client: QueryClient): Promise<void> {
  try {
    const r = await fetch('/api/v1/revisione', { cache: 'no-store', headers: { accept: 'application/json' } })
    if (r.status === 503) {
      segnalaEsito('manutenzione')
      return
    }
    if (r.status === 401) {
      // Server raggiungibile ma questo dispositivo non è (più) autorizzato.
      segnalaEsito('ok')
      segnalaSessionePersa()
      return
    }
    if (!r.ok) throw new Error(String(r.status))
    const { revisione } = SchemaRevisione.parse(await r.json())
    const eraOffline = statoConnessione() !== 'connesso'
    segnalaEsito('ok')
    if (revisione !== revisioneCorrente() || eraOffline) {
      const prima = revisioneCorrente()
      aggiornaRevisione(revisione)
      if (prima !== -1) await client.invalidateQueries()
    }
  } catch {
    segnalaEsito('rete')
  }
}

/** Avvia la sorveglianza; restituisce la funzione per fermarla. */
export function avviaSorveglianza(client: QueryClient, intervallo = INTERVALLO_REVISIONE_MS): () => void {
  void controllaRevisione(client)
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void controllaRevisione(client)
  }, intervallo)
  const visibilita = () => {
    if (document.visibilityState === 'visible') void controllaRevisione(client)
  }
  const online = () => void controllaRevisione(client)
  document.addEventListener('visibilitychange', visibilita)
  window.addEventListener('online', online)
  window.addEventListener('focus', visibilita)
  const togli = quandoTorna(() => void client.invalidateQueries())
  return () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', visibilita)
    window.removeEventListener('online', online)
    window.removeEventListener('focus', visibilita)
    togli()
  }
}
