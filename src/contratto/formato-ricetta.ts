// Validazione del formato ricetta v1 (docs/FORMATO-RICETTA.md).
import { z } from 'zod'
import { FORMATO_RICETTA, type RicettaFormato, VERSIONE_FORMATO_RICETTA } from '../domain/ricetta/formato.ts'
import { SCALATURE } from '../domain/tipi.ts'
import { CODICI_UNITA } from '../domain/unita.ts'

const Minuti = z.number().int().min(0).max(100_000).nullable().optional()
const Quantita = z.number().min(0).max(1_000_000).nullable().optional()

export const SchemaRicettaFormato = z
  .object({
    formato: z.literal(FORMATO_RICETTA, { error: 'Non è una ricetta di Menù & Co.' }),
    versione: z.number().int().min(1).max(VERSIONE_FORMATO_RICETTA, { error: 'Ricetta creata da una versione più recente dell\'app' }),
    nome: z.string().trim().min(1, 'Nome della ricetta mancante').max(200),
    portata: z.string().max(200).nullable().optional(),
    porzioniBase: z.number().positive().max(10_000).nullable().optional(),
    tempi: z.object({ preparazioneMin: Minuti, cotturaMin: Minuti, riposoMin: Minuti }).loose().optional(),
    attrezzature: z.array(z.string().max(200)).max(50).optional(),
    ingredienti: z
      .array(
        z.union([
          z.string().max(500),
          z
            .object({
              testo: z.string().max(500),
              quantita: Quantita,
              quantitaMax: Quantita,
              unita: z.enum(CODICI_UNITA).nullable().optional(),
              nome: z.string().max(200).optional(),
              nota: z.string().max(200).optional(),
              facoltativo: z.boolean().optional(),
              scalatura: z.enum(SCALATURE).optional(),
            })
            .loose(),
        ]),
      )
      .max(200)
      .optional(),
    procedimento: z.array(z.string().max(5000)).max(100).optional(),
    note: z.string().max(20_000).optional(),
    fonte: z.string().max(200).optional(),
    foto: z
      .array(z.object({ file: z.string().max(300), didascalia: z.string().max(200).optional(), principale: z.boolean().optional() }).loose())
      .max(10, 'Al massimo 10 foto per ricetta')
      .optional(),
  })
  .loose()

export function validaRicetta(dati: unknown): { ok: true; ricetta: RicettaFormato } | { ok: false; errore: string } {
  const r = SchemaRicettaFormato.safeParse(dati)
  if (r.success) return { ok: true, ricetta: r.data as RicettaFormato }
  const i = r.error.issues[0]
  return { ok: false, errore: i ? `${i.path.join('.') || 'ricetta'}: ${i.message}` : 'Ricetta non valida' }
}
