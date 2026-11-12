// Contratto API: lista della spesa (SPEC §10, §12.4).
import { z } from 'zod'
import type { AvvisoSpesa } from '../domain/spesa/calcolo.ts'
import type { ListaSpesa } from '../domain/spesa/riconciliazione.ts'
import { STATI_SPESA } from '../domain/tipi.ts'
import { Id, NomeObbligatorio, TestoBreve, Versione } from './comune.ts'

export interface RispostaSpesa extends ListaSpesa {
  avvisi: AvvisoSpesa[]
  copertiEquivalenti: number
  /** Evento archiviato: lista letta dallo snapshot. */
  solaLettura: boolean
}

export const SchemaRispostaSpesa = z.object({
  voci: z.array(z.object({ chiave: z.string(), sezione: z.string(), caso: z.string(), stato: z.enum(STATI_SPESA), versione: Versione }).loose()),
  manuali: z.array(z.object({ id: Id, nome: z.string(), stato: z.enum(STATI_SPESA), versione: Versione }).loose()),
  contatori: z.record(z.string(), z.number()),
  avvisi: z.array(z.object({ tipo: z.string(), messaggio: z.string() }).loose()),
  copertiEquivalenti: z.number(),
  solaLettura: z.boolean(),
})

const Quantita = z.number().min(0).max(10_000_000).nullable()

export const SchemaAggiornaRiga = z.object({
  stato: z.enum(STATI_SPESA),
  quantitaUtente: Quantita,
  repartoId: Id.nullable(),
  nascosto: z.boolean(),
  inclusa: z.boolean(),
  nota: TestoBreve,
  /** R3 «Coperto anche l'aumento»: registra come coperto il fabbisogno attuale. */
  aggiornaCopertura: z.boolean().optional(),
  versione: Versione,
})
export type AggiornaRiga = z.infer<typeof SchemaAggiornaRiga>

export const SchemaTrasferisci = z.object({ da: z.string().min(1), a: z.string().min(1), versione: Versione })

export const SchemaNuovoManuale = z.object({ id: Id, nome: NomeObbligatorio, quantitaTesto: TestoBreve, repartoId: Id.nullable(), nota: TestoBreve })
export const SchemaAggiornaManuale = z.object({
  nome: NomeObbligatorio,
  quantitaTesto: TestoBreve,
  repartoId: Id.nullable(),
  nota: TestoBreve,
  stato: z.enum(STATI_SPESA),
  versione: Versione,
})
