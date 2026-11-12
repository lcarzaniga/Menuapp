// Contratto API: backup, esportazione, ripristino (SPEC §11).
import { z } from 'zod'

export const SchemaInfoBackup = z.object({
  nome: z.string(),
  tipo: z.enum(['giornaliero', 'settimanale', 'pre-migrazione', 'pre-ripristino', 'manuale']),
  creatoIl: z.string(),
  versioneSchema: z.number().int(),
  byte: z.number().int(),
  sha256: z.string(),
  conteggi: z.record(z.string(), z.number()),
  verificato: z.boolean(),
})
export type InfoBackupApi = z.infer<typeof SchemaInfoBackup>

export const SchemaStatoBackup = z.object({
  backup: z.array(SchemaInfoBackup),
  ultimaEsportazione: z.string().nullable(),
  avvisi: z.array(z.string()),
})
export type StatoBackup = z.infer<typeof SchemaStatoBackup>

export const FORMATO_ESPORTAZIONE = 'menuapp-esportazione'

export const SchemaEsportazione = z.object({
  formato: z.literal(FORMATO_ESPORTAZIONE),
  versioneFormato: z.literal(1),
  versioneSchema: z.number().int().min(1),
  versioneApp: z.string(),
  esportatoAt: z.string(),
  conteggi: z.record(z.string(), z.number()),
  impronta: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  dati: z.record(z.string(), z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))),
})
export type Esportazione = z.infer<typeof SchemaEsportazione>

export const SchemaRichiestaVerifica = z.discriminatedUnion('origine', [
  z.object({ origine: z.literal('backup'), nome: z.string().min(1).max(200) }),
  z.object({ origine: z.literal('file'), contenuto: z.unknown() }),
])
export type RichiestaVerifica = z.infer<typeof SchemaRichiestaVerifica>

export const SchemaRiepilogoRipristino = z.object({
  token: z.string(),
  scadeIl: z.string(),
  origine: z.string(),
  dataDati: z.string(),
  versioneSchema: z.number().int(),
  conteggi: z.record(z.string(), z.number()),
  avvisi: z.array(z.string()),
})
export type RiepilogoRipristino = z.infer<typeof SchemaRiepilogoRipristino>

export const FRASE_CONFERMA_RIPRISTINO = 'RIPRISTINA'

export const SchemaEseguiRipristino = z.object({
  token: z.string().min(1),
  conferma: z.literal(FRASE_CONFERMA_RIPRISTINO, { error: 'Scrivi RIPRISTINA per confermare' }),
})

export const SchemaEsitoRipristino = z.object({
  ok: z.literal(true),
  backupPrecedente: z.string(),
  conteggi: z.record(z.string(), z.number()),
  fotoMancanti: z.array(z.string()),
})
