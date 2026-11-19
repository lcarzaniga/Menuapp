// Memoria di famiglia (SPEC §40): storia della ricetta, ricordi dei familiari, esperienze di
// preparazione. Ogni contributo ha autore e data; le foto sono quelle della ricetta (SchemaFoto).
import { z } from 'zod'
import { Epoch, Id, TestoLungo, Versione } from './comune.ts'
import { SchemaFoto } from './foto.ts'

export const TIPI_MEMORIA = ['storia', 'ricordo', 'esperienza'] as const

export const SchemaMemoria = z.object({
  id: Id,
  tipo: z.enum(TIPI_MEMORIA),
  testo: z.string(),
  /** Esperienze: l'evento in cui la ricetta è stata preparata (se l'utente lo vede ancora). */
  evento: z.object({ id: Id, nome: z.string() }).nullable(),
  /** Solo la storia: pubblicata insieme alla ricetta pubblica. */
  pubblica: z.boolean(),
  autore: z.object({ id: Id.nullable(), nome: z.string() }),
  foto: z.array(SchemaFoto),
  puoModificare: z.boolean(),
  puoEliminare: z.boolean(),
  versione: Versione,
  creatoIl: Epoch,
  aggiornatoIl: Epoch,
})
export type Memoria = z.infer<typeof SchemaMemoria>

export const SchemaMemoriaRicetta = z.object({
  storia: SchemaMemoria.nullable(),
  ricordi: z.array(SchemaMemoria),
  esperienze: z.array(SchemaMemoria),
  /** Chi fa parte della ricetta (proprietario, Famiglia) aggiunge ricordi ed esperienze. */
  puoContribuire: z.boolean(),
  /** La storia la scrive il proprietario della ricetta. */
  puoScrivereStoria: z.boolean(),
  /** Vede solo ciò che è pubblico (la storia pubblicata): ricordi ed esperienze restano privati. */
  soloPubblica: z.boolean(),
})
export type MemoriaRicetta = z.infer<typeof SchemaMemoriaRicetta>

export const SchemaStoria = z.object({ testo: TestoLungo, pubblica: z.boolean(), versione: Versione.optional() })
export const SchemaNuovaMemoria = z.object({ id: Id, tipo: z.enum(['ricordo', 'esperienza']), testo: TestoLungo, eventoId: Id.nullable().optional() })
export const SchemaAggiornaMemoria = z.object({ testo: TestoLungo, eventoId: Id.nullable().optional(), versione: Versione })
