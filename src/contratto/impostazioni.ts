// Contratto API: impostazioni e reparti.
import { z } from 'zod'
import { Epoch, Id, NomeObbligatorio, Versione } from './comune.ts'

export const SchemaPortataPredefinita = z.object({
  id: Id,
  nome: NomeObbligatorio,
  ordine: z.number().int().min(0),
})

export const Coefficiente = z
  .number()
  .min(0, 'Il coefficiente va da 0 a 1')
  .max(1, 'Il coefficiente va da 0 a 1')
  .refine((n) => Math.abs(n * 20 - Math.round(n * 20)) < 1e-9, 'Il coefficiente va a passi di 0,05')

export const SchemaImpostazioni = z.object({
  coefficienteBambini: Coefficiente,
  portatePredefinite: z.array(SchemaPortataPredefinita),
  versione: Versione,
  aggiornatoIl: Epoch,
})

export const SchemaAggiornaImpostazioni = z.object({
  coefficienteBambini: Coefficiente,
  portatePredefinite: z
    .array(z.object({ id: Id, nome: NomeObbligatorio }))
    .min(1, 'Serve almeno una portata')
    .max(30),
  versione: Versione,
})
export type AggiornaImpostazioni = z.infer<typeof SchemaAggiornaImpostazioni>

export const SchemaReparto = z.object({
  id: Id,
  nome: NomeObbligatorio,
  ordine: z.number().int().min(0),
  diSistema: z.boolean(),
  versione: Versione,
  creatoIl: Epoch,
  aggiornatoIl: Epoch,
})

export const SchemaNuovoReparto = z.object({ id: Id, nome: NomeObbligatorio })
export const SchemaAggiornaReparto = z.object({ nome: NomeObbligatorio, versione: Versione })
