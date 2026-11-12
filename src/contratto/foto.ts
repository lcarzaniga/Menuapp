// Contratto API: foto dei piatti (formato ricetta v1).
import { z } from 'zod'
import { Epoch, Id, TestoBreve, Versione } from './comune.ts'

export const TIPI_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const
export type TipoFoto = (typeof TIPI_FOTO)[number]
export const MASSIMO_FOTO = 10
export const LIMITE_BYTE_FOTO = 8 * 1024 * 1024

export const SchemaFoto = z.object({
  id: Id,
  piattoId: Id,
  ordine: z.number().int(),
  didascalia: z.string(),
  principale: z.boolean(),
  /** Passaggio del procedimento (indice da 0), o null se la foto è solo nella galleria. */
  passo: z.number().int().min(0).nullable(),
  tipo: z.enum(TIPI_FOTO),
  byte: z.number().int(),
  sha256: z.string(),
  versione: Versione,
  creatoIl: Epoch,
})
export type Foto = z.infer<typeof SchemaFoto>

/** Parametri del caricamento (il corpo è il file). */
export const SchemaQueryCaricaFoto = z.object({
  id: Id,
  didascalia: TestoBreve.optional().default(''),
  principale: z.enum(['0', '1']).optional().default('0'),
  passo: z.coerce.number().int().min(0).max(99).optional(),
})

export const SchemaAggiornaFoto = z.object({ didascalia: TestoBreve, principale: z.boolean(), passo: z.number().int().min(0).max(99).nullable(), versione: Versione })
