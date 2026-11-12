// Contratto API: stile del menù stampato, uno per evento (SPEC F8).
import { z } from 'zod'
import {
  CARATTERI_STAMPA,
  FORMATI_STAMPA,
  LIMITI_STAMPA,
  MODELLI_STAMPA,
  type OpzioniStampa,
  PALETTE_STAMPA,
} from '../domain/stampa.ts'
import { Epoch, Id, Versione } from './comune.ts'

const Riga = (max: number, cosa: string) => z.string().max(max, `${cosa}: al massimo ${max} caratteri`)

export const SchemaOpzioniStampa = z.object({
  modello: z.enum(MODELLI_STAMPA),
  formato: z.enum(FORMATI_STAMPA),
  titolo: Riga(LIMITI_STAMPA.titolo, 'Titolo').nullable(),
  sottotitolo: Riga(LIMITI_STAMPA.sottotitolo, 'Sottotitolo'),
  mostraData: z.boolean(),
  nota: Riga(LIMITI_STAMPA.nota, 'Nota finale'),
  palette: z.enum(PALETTE_STAMPA),
  caratteri: z.enum(CARATTERI_STAMPA),
  decorazioni: z.boolean(),
  nascondiPortateVuote: z.boolean(),
  mostraNote: z.boolean(),
}) satisfies z.ZodType<OpzioniStampa>

export const SchemaStileStampa = z.object({
  eventoId: Id,
  opzioni: SchemaOpzioniStampa,
  /** 0 = mai salvato: le opzioni sono i predefiniti dell'evento. */
  versione: Versione,
  aggiornatoIl: Epoch.nullable(),
})
export type StileStampa = z.infer<typeof SchemaStileStampa>

/** Salvataggio: versione 0 per il primo salvataggio, poi quella letta. */
export const SchemaSalvaStileStampa = z.object({ opzioni: SchemaOpzioniStampa, versione: Versione })
export type SalvaStileStampa = z.infer<typeof SchemaSalvaStileStampa>

/**
 * Opzioni salvate in passato con valori non più ammessi (es. una palette tolta): ogni campo
 * non valido torna al predefinito, gli altri restano.
 */
export function opzioniDaSalvate(salvate: unknown, predefinite: OpzioniStampa): OpzioniStampa {
  const s = (salvate && typeof salvate === 'object' ? salvate : {}) as Record<string, unknown>
  const out: Record<string, unknown> = { ...predefinite }
  for (const [k, schema] of Object.entries(SchemaOpzioniStampa.shape)) {
    if (k in s && schema.safeParse(s[k]).success) out[k] = s[k]
  }
  return out as unknown as OpzioniStampa
}
