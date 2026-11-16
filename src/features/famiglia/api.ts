// Letture dello spazio della famiglia (TanStack Query): bacheche, notifiche, incarichi, valutazioni.
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Bacheca, Gruppo, Incarichi, Notifica, TipoNotifica, ValutazioniEvento, VoceClassifica } from '@/contratto/famiglia.ts'

export type AmbitoBacheca = { tipo: 'gruppo' | 'evento'; id: string }
export const percorsoBacheca = (a: AmbitoBacheca) => (a.tipo === 'gruppo' ? `/gruppi/${a.id}` : `/eventi/${a.id}`)

export const chiaviFamiglia = {
  gruppi: ['gruppi'] as const,
  bacheca: (a: AmbitoBacheca) => ['bacheca', a.tipo, a.id] as const,
  notifiche: ['notifiche'] as const,
  conteggio: ['notifiche', 'conteggio'] as const,
  preferenze: ['notifiche', 'preferenze'] as const,
  incarichi: (eventoId: string) => ['incarichi', eventoId] as const,
  valutazioni: (eventoId: string) => ['valutazioni', eventoId] as const,
  classifica: (portata: string, anno: string, gruppo: string) => ['classifica', portata, anno, gruppo] as const,
}

export const useGruppi = () => useQuery({ queryKey: chiaviFamiglia.gruppi, queryFn: () => api.leggi<Gruppo[]>('/gruppi'), staleTime: 60_000 })
export const useBacheca = (a: AmbitoBacheca) =>
  useQuery({ queryKey: chiaviFamiglia.bacheca(a), queryFn: () => api.leggi<Bacheca>(`${percorsoBacheca(a)}/bacheca`), enabled: Boolean(a.id) })
export const useNotifiche = () => useQuery({ queryKey: chiaviFamiglia.notifiche, queryFn: () => api.leggi<Notifica[]>('/notifiche') })
/** Contatore della campanella: si aggiorna con la revisione (ogni 10 s) e comunque ogni minuto. */
export const useConteggioNotifiche = () =>
  useQuery({ queryKey: chiaviFamiglia.conteggio, queryFn: () => api.leggi<{ nonLette: number }>('/notifiche/conteggio'), refetchInterval: 60_000 })
export const usePreferenzeNotifiche = () => useQuery({ queryKey: chiaviFamiglia.preferenze, queryFn: () => api.leggi<{ disattivate: TipoNotifica[] }>('/notifiche/preferenze') })
export const useIncarichi = (eventoId: string) => useQuery({ queryKey: chiaviFamiglia.incarichi(eventoId), queryFn: () => api.leggi<Incarichi>(`/eventi/${eventoId}/incarichi`) })
export const useValutazioni = (eventoId: string) =>
  useQuery({ queryKey: chiaviFamiglia.valutazioni(eventoId), queryFn: () => api.leggi<ValutazioniEvento>(`/eventi/${eventoId}/valutazioni`) })
/** Classifica della Famiglia indicata (separata per Famiglia). */
export const useClassifica = (portata: string, anno: string, gruppo: string) =>
  useQuery({
    queryKey: chiaviFamiglia.classifica(portata, anno, gruppo),
    queryFn: () => api.leggi<VoceClassifica[]>(`/classifica?${new URLSearchParams({ gruppo, ...(portata ? { portata } : {}), ...(anno ? { anno } : {}) })}`),
  })

/** «3 min fa», «ieri alle 20:15», «12 dic». */
export function quando(ms: number, adesso = Date.now()): string {
  const s = Math.round((adesso - ms) / 1000)
  if (s < 60) return 'adesso'
  if (s < 3600) return `${Math.floor(s / 60)} min fa`
  const d = new Date(ms)
  const oggi = new Date(adesso)
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === oggi.toDateString()) return `oggi alle ${ora}`
  const ieri = new Date(adesso - 86_400_000)
  if (d.toDateString() === ieri.toDateString()) return `ieri alle ${ora}`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', ...(d.getFullYear() !== oggi.getFullYear() ? { year: 'numeric' } : {}) })
}
