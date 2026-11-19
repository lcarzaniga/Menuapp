// Contratto API: segnaposto nominativi di un evento (SPEC §42). Si salvano con lo stile del menù
// (stessa riga di `stili_stampa`, stessa versione), sotto la chiave `segnaposto`.
import { z } from 'zod'
import { FORMATI_SEGNAPOSTO, LIMITI_SEGNAPOSTO, type OpzioniSegnaposto, segnapostoPredefiniti, type StileSegnaposto } from '../domain/segnaposto.ts'
import { CARATTERI_STAMPA, MODELLI_STAMPA, PALETTE_STAMPA } from '../domain/stampa.ts'
import { Epoch, Id, Versione } from './comune.ts'

export const SchemaNomeSegnaposto = z.object({
  id: Id,
  testo: z.string().max(LIMITI_SEGNAPOSTO.nome, `Nome: al massimo ${LIMITI_SEGNAPOSTO.nome} caratteri`),
  stampa: z.boolean(),
  copie: z.number().int('Copie: numero intero').min(1, 'Almeno una copia').max(LIMITI_SEGNAPOSTO.copie, `Al massimo ${LIMITI_SEGNAPOSTO.copie} copie`),
})

export const SchemaStileSegnaposto = z.object({
  modello: z.enum(MODELLI_STAMPA),
  palette: z.enum(PALETTE_STAMPA),
  caratteri: z.enum(CARATTERI_STAMPA),
  decorazioni: z.boolean(),
}) satisfies z.ZodType<StileSegnaposto>

export const SchemaOpzioniSegnaposto = z.object({
  formato: z.enum(FORMATI_SEGNAPOSTO),
  nomi: z.array(SchemaNomeSegnaposto).max(LIMITI_SEGNAPOSTO.nomi, `Al massimo ${LIMITI_SEGNAPOSTO.nomi} nomi`),
  secondaFaccia: z.boolean(),
  mostraEvento: z.boolean(),
  testoEvento: z.string().max(LIMITI_SEGNAPOSTO.testoEvento, `Nome dell'evento: al massimo ${LIMITI_SEGNAPOSTO.testoEvento} caratteri`).nullable(),
  lineeTaglio: z.boolean(),
  stile: SchemaStileSegnaposto.nullable(),
}) satisfies z.ZodType<OpzioniSegnaposto>

export const SchemaSegnaposto = z.object({
  eventoId: Id,
  opzioni: SchemaOpzioniSegnaposto,
  /** false: mai salvati, i nomi sono quelli proposti dai partecipanti. */
  salvati: z.boolean(),
  /** Nomi dei partecipanti (confermati e in attesa), per «Aggiungi dai partecipanti». */
  nomiPartecipanti: z.array(z.string()),
  /** Lo stile attuale del menù: quello dei segnaposto quando `opzioni.stile` è null. */
  stileMenu: SchemaStileSegnaposto,
  /** Versione della riga dello stile di stampa (0 = mai salvata). */
  versione: Versione,
  aggiornatoIl: Epoch.nullable(),
})
export type Segnaposto = z.infer<typeof SchemaSegnaposto>

export const SchemaSalvaSegnaposto = z.object({ opzioni: SchemaOpzioniSegnaposto, versione: Versione })
export type SalvaSegnaposto = z.infer<typeof SchemaSalvaSegnaposto>

/**
 * Segnaposto salvati in passato con valori non più ammessi: ogni campo non valido torna al
 * predefinito, i nomi non validi si scartano. undefined = mai salvati.
 */
export function segnapostoDaSalvati(salvati: unknown): OpzioniSegnaposto | undefined {
  if (!salvati || typeof salvati !== 'object') return undefined
  const s = salvati as Record<string, unknown>
  const out: Record<string, unknown> = { ...segnapostoPredefiniti() }
  for (const [k, schema] of Object.entries(SchemaOpzioniSegnaposto.shape)) {
    if (k === 'nomi') continue
    if (k in s && schema.safeParse(s[k]).success) out[k] = s[k]
  }
  out.nomi = Array.isArray(s.nomi) ? s.nomi.filter((n) => SchemaNomeSegnaposto.safeParse(n).success).slice(0, LIMITI_SEGNAPOSTO.nomi) : []
  return out as unknown as OpzioniSegnaposto
}
