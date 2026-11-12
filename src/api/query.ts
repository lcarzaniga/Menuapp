// Query condivise (TanStack Query): chiavi e letture dal server.
import { useQuery } from '@tanstack/react-query'
import { SchemaStatoBackup } from '@/contratto/backup.ts'
import { SchemaSalute } from '@/contratto/comune.ts'
import type { Menu, RiepilogoEvento } from '@/contratto/eventi.ts'
import type { DettaglioPiatto, RiepilogoPiatto } from '@/contratto/ricettario.ts'
import type { InfoRiapertura, Snapshot } from '@/contratto/archivio.ts'
import type { RispostaSpesa } from '@/contratto/spesa.ts'
import type { StileStampa } from '@/contratto/stampa.ts'
import type { Attivita, Evento, Impostazioni, Ingrediente, Reparto, StatoEvento } from '@/domain/tipi.ts'
import { api } from './client'

export const chiavi = {
  salute: ['salute'] as const,
  impostazioni: ['impostazioni'] as const,
  reparti: ['reparti'] as const,
  backup: ['backup'] as const,
}

export const useSalute = () => useQuery({ queryKey: chiavi.salute, queryFn: () => api.leggi('/salute', SchemaSalute) })
export const useImpostazioni = () => useQuery({ queryKey: chiavi.impostazioni, queryFn: () => api.leggi<Impostazioni>('/impostazioni') })
export const useReparti = () => useQuery({ queryKey: chiavi.reparti, queryFn: () => api.leggi<Reparto[]>('/reparti') })
export const useStatoBackup = () => useQuery({ queryKey: chiavi.backup, queryFn: () => api.leggi('/backup', SchemaStatoBackup) })

// ── Eventi e menù ───────────────────────────────────────────

export const chiaviEventi = {
  elenco: (stato?: StatoEvento) => ['eventi', stato ?? 'tutti'] as const,
  evento: (id: string) => ['evento', id] as const,
  menu: (id: string) => ['menu', id] as const,
  stampa: (id: string) => ['stampa', id] as const,
}

export const useEventi = (stato?: StatoEvento) =>
  useQuery({ queryKey: chiaviEventi.elenco(stato), queryFn: () => api.leggi<RiepilogoEvento[]>(stato ? `/eventi?stato=${stato}` : '/eventi') })
export const useEvento = (id: string) => useQuery({ queryKey: chiaviEventi.evento(id), queryFn: () => api.leggi<Evento>(`/eventi/${id}`) })
export const useMenu = (id: string) => useQuery({ queryKey: chiaviEventi.menu(id), queryFn: () => api.leggi<Menu>(`/eventi/${id}/menu`) })
export const useStileStampa = (id: string) =>
  useQuery({ queryKey: chiaviEventi.stampa(id), queryFn: () => api.leggi<StileStampa>(`/eventi/${id}/stampa`) })

// ── Ricettario e catalogo ───────────────────────────────────
export const chiaviRicettario = {
  piatti: ['piatti'] as const,
  piatto: (id: string) => ['piatto', id] as const,
  ingredienti: ['ingredienti'] as const,
}
export const usePiatti = () => useQuery({ queryKey: chiaviRicettario.piatti, queryFn: () => api.leggi<RiepilogoPiatto[]>('/piatti') })
export const usePiatto = (id: string) =>
  useQuery({ queryKey: chiaviRicettario.piatto(id), queryFn: () => api.leggi<DettaglioPiatto>(`/piatti/${id}`), enabled: Boolean(id) })
export const useIngredienti = () =>
  useQuery({ queryKey: chiaviRicettario.ingredienti, queryFn: () => api.leggi<Ingrediente[]>('/ingredienti'), staleTime: 60_000 })

// ── Spesa, piano, archivio ──────────────────────────────────
export const useSpesa = (id: string) => useQuery({ queryKey: ['spesa', id], queryFn: () => api.leggi<RispostaSpesa>(`/eventi/${id}/spesa`) })
export const useAttivita = (id: string) => useQuery({ queryKey: ['attivita', id], queryFn: () => api.leggi<Attivita[]>(`/eventi/${id}/attivita`) })
export const useSnapshot = (id: string, attivo = true) =>
  useQuery({ queryKey: ['snapshot', id], queryFn: () => api.leggi<Snapshot[]>(`/eventi/${id}/snapshot`), enabled: attivo })
export const useRiapertura = (id: string, attivo: boolean) =>
  useQuery({ queryKey: ['riapertura', id], queryFn: () => api.leggi<InfoRiapertura>(`/eventi/${id}/riapertura`), enabled: attivo })
