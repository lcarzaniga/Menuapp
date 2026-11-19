// Query condivise (TanStack Query): chiavi e letture dal server.
import { useQuery } from '@tanstack/react-query'
import { SchemaStatoBackup } from '@/contratto/backup.ts'
import { SchemaSalute } from '@/contratto/comune.ts'
import type { Edizioni, PerTe, Ricorrenza } from '@/contratto/edizioni.ts'
import type { Menu, RiepilogoEvento } from '@/contratto/eventi.ts'
import type { DettaglioPiatto, Preferenze, RiepilogoPiatto } from '@/contratto/ricettario.ts'
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
  elenco: (stato?: StatoEvento, gruppo?: string) => ['eventi', stato ?? 'tutti', gruppo ?? ''] as const,
  evento: (id: string) => ['evento', id] as const,
  menu: (id: string) => ['menu', id] as const,
  stampa: (id: string) => ['stampa', id] as const,
}

/** Eventi visibili; con `gruppo` (Famiglia attiva) quelli della Famiglia più i personali. */
export const useEventi = (stato?: StatoEvento, gruppo?: string) =>
  useQuery({
    queryKey: chiaviEventi.elenco(stato, gruppo),
    queryFn: () => api.leggi<RiepilogoEvento[]>(`/eventi?${new URLSearchParams({ ...(stato ? { stato } : {}), ...(gruppo ? { gruppo } : {}) })}`),
  })
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
/** Ricette dell'utente; con `pubbliche` anche quelle pubbliche nell'app, o solo quelle (SPEC §36). */
export const usePiatti = (pubbliche: 'no' | 'si' | 'solo' = 'no') =>
  useQuery({
    queryKey: [...chiaviRicettario.piatti, pubbliche],
    queryFn: () => api.leggi<RiepilogoPiatto[]>(pubbliche === 'no' ? '/piatti' : `/piatti?pubbliche=${pubbliche}`),
  })
export const usePreferenze = () => useQuery({ queryKey: ['preferenze'], queryFn: () => api.leggi<Preferenze>('/account/preferenze') })
/** «Includi ricette pubbliche»: spenta finché le preferenze non sono arrivate. */
export const useIncludiPubbliche = () => usePreferenze().data?.includiPubbliche ?? false
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

// ── Edizioni, ricorrenze, «Per te» (SPEC §28, §30, §31) ──────
export const useEdizioni = (eventoId: string) =>
  useQuery({ queryKey: ['edizioni', eventoId], queryFn: () => api.leggi<Edizioni>(`/eventi/${eventoId}/edizioni`) })
export const useRicorrenze = (gruppoId: string | null) =>
  useQuery({ queryKey: ['ricorrenze', gruppoId], queryFn: () => api.leggi<Ricorrenza[]>(`/famiglie/${gruppoId}/ricorrenze`), enabled: Boolean(gruppoId) })
export const usePerTe = () => useQuery({ queryKey: ['per-te'], queryFn: () => api.leggi<PerTe>('/per-te') })
