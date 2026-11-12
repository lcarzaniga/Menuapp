// Contratto API: elementi comuni (SPEC §12.4).
import { z } from 'zod'

export const PREFISSO_API = '/api/v1'

export const CODICI_ERRORE = [
  'richiesta_non_valida',
  'origine_non_ammessa',
  'non_trovato',
  'conflitto_versione',
  'id_esistente',
  'troppo_grande',
  'tipo_non_supportato',
  'regola_violata',
  'servizio_non_pronto',
  'errore_interno',
] as const
export type CodiceErrore = (typeof CODICI_ERRORE)[number]

export const SchemaErrore = z.object({
  errore: z.object({
    codice: z.enum(CODICI_ERRORE),
    messaggio: z.string(),
    dettagli: z.unknown().optional(),
  }),
})
export type RispostaErrore = z.infer<typeof SchemaErrore>

export const Id = z.string().trim().min(1).max(100)
export const Versione = z.number().int().min(0)
export const TestoBreve = z.string().max(200)
export const TestoLungo = z.string().max(20_000)
export const NomeObbligatorio = z.string().trim().min(1, 'Il nome è obbligatorio').max(200)
export const DataISO = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Data non valida (AAAA-MM-GG)')
export const Ora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Ora non valida (HH:MM)')
export const Epoch = z.number().int()

/** Corpo di un'azione che richiede solo la versione letta. */
export const SchemaVersione = z.object({ versione: Versione })

export const SchemaRiordino = z.object({
  voci: z.array(z.object({ id: Id, versione: Versione })).max(500),
})

export const SchemaSalute = z.object({
  ok: z.boolean(),
  versioneApp: z.string(),
  versioneApi: z.literal(1),
  versioneSchema: z.number().int(),
  rilascio: z.string(),
  revisione: z.number().int(),
  ultimoBackup: z
    .object({ nome: z.string(), creatoIl: z.string(), tipo: z.string(), esito: z.enum(['ok', 'errore']), messaggio: z.string().optional() })
    .nullable(),
})
export type Salute = z.infer<typeof SchemaSalute>

export const SchemaRevisione = z.object({ revisione: z.number().int() })
