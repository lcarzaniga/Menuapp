// Sessione corrente, persone e accesso agli eventi (SPEC §19).
import { useQuery } from '@tanstack/react-query'
import type { AccessoEvento, Persona, SessioneCorrente } from '@/contratto/accesso.ts'
import { api, ErroreRichiesta } from '@/api/client'

export const chiaviAccesso = {
  sessione: ['sessione'] as const,
  persone: ['persone'] as const,
  evento: (id: string) => ['accesso-evento', id] as const,
}

/** Sessione di questo dispositivo: null se non è autorizzato. */
export const useSessione = () =>
  useQuery({
    queryKey: chiaviAccesso.sessione,
    queryFn: async (): Promise<SessioneCorrente | null> => {
      try {
        return await api.leggi<SessioneCorrente>('/sessione')
      } catch (e) {
        if (e instanceof ErroreRichiesta && e.stato === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
    retry: (n, e) => !(e instanceof ErroreRichiesta && e.codice !== 'rete') && n < 2,
  })

/** Utente corrente (dentro l'app la sessione c'è sempre). */
export function useUtenteCorrente() {
  const s = useSessione().data
  return {
    utente: s?.utente ?? null,
    amministratore: s?.utente.ruolo === 'amministratore',
    /** Funzioni di sistema e gestione utenti: solo dall'indirizzo privato (Tailscale). */
    ingressoPrivato: s?.ingresso === 'privato',
  }
}

export const usePersone = () => useQuery({ queryKey: chiaviAccesso.persone, queryFn: () => api.leggi<Persona[]>('/persone'), staleTime: 60_000 })

export const useAccessoEvento = (id: string) =>
  useQuery({ queryKey: chiaviAccesso.evento(id), queryFn: () => api.leggi<AccessoEvento>(`/eventi/${id}/accesso`), enabled: Boolean(id) })

/** Nome del dispositivo proposto all'attivazione. */
export function nomeDispositivoProposto(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const sistema = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Telefono Android' : 'Tablet Android') : /Windows/.test(ua) ? 'PC Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'PC Linux' : 'Dispositivo'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${sistema} · ${browser}` : sistema
}

export const dataOra = (ms: number) => new Date(ms).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
