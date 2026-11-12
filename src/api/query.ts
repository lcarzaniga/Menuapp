// Query condivise (TanStack Query): chiavi e letture dal server.
import { useQuery } from '@tanstack/react-query'
import { SchemaStatoBackup } from '@/contratto/backup.ts'
import { SchemaSalute } from '@/contratto/comune.ts'
import type { Menu, RiepilogoEvento } from '@/contratto/eventi.ts'
import type { Evento, Impostazioni, Reparto, StatoEvento } from '@/domain/tipi.ts'
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
}

export const useEventi = (stato?: StatoEvento) =>
  useQuery({ queryKey: chiaviEventi.elenco(stato), queryFn: () => api.leggi<RiepilogoEvento[]>(stato ? `/eventi?stato=${stato}` : '/eventi') })
export const useEvento = (id: string) => useQuery({ queryKey: chiaviEventi.evento(id), queryFn: () => api.leggi<Evento>(`/eventi/${id}`) })
export const useMenu = (id: string) => useQuery({ queryKey: chiaviEventi.menu(id), queryFn: () => api.leggi<Menu>(`/eventi/${id}/menu`) })
