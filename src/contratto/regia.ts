// Regia della cucina (SPEC §38): le attività del piano con i piatti, i tempi e le attrezzature delle
// ricette, in una sola richiesta. Nessun dato nuovo: tutto viene dal piano e dal ricettario.
import { z } from 'zod'
import { DataISO, Id, Versione } from './comune.ts'

export const SchemaPiattoRegia = z.object({
  voceId: Id,
  nome: z.string(),
  portata: z.string(),
  piattoId: Id.nullable(),
  /** Minuti di preparazione, cottura e riposo della ricetta (null se non indicati). */
  preparazione: z.number().int().nullable(),
  cottura: z.number().int().nullable(),
  riposo: z.number().int().nullable(),
  /** Attrezzature scritte nella ricetta, così come sono. */
  attrezzature: z.array(z.string()),
  /** Forno, fornelli, frigo: ricavati dal testo della ricetta (un'indicazione, D10). */
  usa: z.array(z.enum(['forno', 'fornelli', 'frigo'])),
})
export type PiattoRegia = z.infer<typeof SchemaPiattoRegia>

export const SchemaAttivitaRegia = z.object({
  id: Id,
  eventoId: Id,
  titolo: z.string(),
  data: DataISO,
  ora: z.string().nullable(),
  stato: z.enum(['da_fare', 'fatto']),
  voceMenuId: Id.nullable(),
  note: z.string(),
  ordine: z.number().int(),
  versione: Versione,
  creatoIl: z.number(),
  aggiornatoIl: z.number(),
})

export const SchemaRegia = z.object({
  evento: z.object({ id: Id, nome: z.string(), data: DataISO, oraServizio: z.string().nullable(), archiviato: z.boolean() }),
  attivita: z.array(SchemaAttivitaRegia),
  /** Tutti i piatti del menù, nell'ordine del menù (anche quelli senza attività). */
  piatti: z.array(SchemaPiattoRegia),
  /** Chi può spuntare le attività (come nel piano). */
  puoModificare: z.boolean(),
})
export type Regia = z.infer<typeof SchemaRegia>
