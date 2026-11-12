// Query condivise (TanStack Query): chiavi e letture dal server.
import { useQuery } from '@tanstack/react-query'
import { SchemaStatoBackup } from '@/contratto/backup.ts'
import { SchemaSalute } from '@/contratto/comune.ts'
import type { Impostazioni, Reparto } from '@/domain/tipi.ts'
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
