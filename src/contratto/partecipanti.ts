// Contratto API: partecipanti, conferme, accompagnatori e coperti (SPEC §24).
import { z } from 'zod'
import { CATEGORIE_PERSONA, STATI_PRESENZA } from '../domain/partecipanti.ts'
import { SchemaPersona } from './accesso.ts'
import { Id, TestoBreve, Versione } from './comune.ts'

const Quanti = z.number().int('Numero intero').min(0, 'Non può essere negativo').max(99)
export const SchemaAnonimi = z.object({ adultiConfermati: Quanti, adultiInAttesa: Quanti, bambiniConfermati: Quanti, bambiniInAttesa: Quanti })

const SchemaConteggio = z.object({ confermati: z.number().int(), inAttesa: z.number().int(), assenti: z.number().int() })
export const SchemaConteggioPresenze = z.object({ adulti: SchemaConteggio, bambini: SchemaConteggio, inviti: z.number().int(), persone: z.number().int() })

export const SchemaPartecipante = z.object({
  id: Id,
  /** Titolare dell'invito (null: è lui il titolare). */
  invitoId: Id.nullable(),
  nome: z.string(),
  categoria: z.enum(CATEGORIE_PERSONA),
  stato: z.enum(STATI_PRESENZA),
  note: z.string(),
  /** Collegamenti facoltativi (non danno accesso all'evento). */
  utenteId: Id.nullable(),
  esternoId: Id.nullable(),
  anonimi: SchemaAnonimi,
  /** Incarichi di «Chi porta» affidati a questa persona. */
  incarichi: z.array(z.string()),
  versione: Versione,
})
export type Partecipante = z.infer<typeof SchemaPartecipante>

export const SchemaInvito = SchemaPartecipante.extend({ accompagnatori: z.array(SchemaPartecipante) })
export type Invito = z.infer<typeof SchemaInvito>

export const SchemaPartecipanti = z.object({
  inviti: z.array(SchemaInvito),
  conteggio: SchemaConteggioPresenze,
  copertiAutomatici: z.boolean(),
  copertiManuali: z.object({ adulti: z.number().int(), bambini: z.number().int() }),
  /** Adulti e bambini confermati: i coperti in modalità automatica. */
  copertiCalcolati: z.object({ adulti: z.number().int(), bambini: z.number().int() }),
  coefficienteBambini: z.number(),
  maxAccompagnatori: z.number().int().nullable(),
  /** Chi organizza (proprietario o in modifica) gestisce tutte le presenze. */
  puoGestire: z.boolean(),
  /** Invito dell'utente corrente, se è collegato a un partecipante. */
  mioInvitoId: Id.nullable(),
  /** Evento archiviato: elenco com'era all'archiviazione. */
  solaLettura: z.boolean(),
  /** Per aggiungere: persone con l'app (Famiglia ed evento) e rubrica (solo a chi organizza). */
  scelte: z.object({ persone: z.array(SchemaPersona), rubrica: z.array(SchemaPersona) }),
})
export type Partecipanti = z.infer<typeof SchemaPartecipanti>

export const SchemaNuovoPartecipante = z
  .object({
    id: Id,
    /** Accompagnatore nominativo di questo invito; assente: un nuovo invito. */
    invitoId: Id.nullable().optional(),
    utenteId: Id.optional(),
    esternoId: Id.optional(),
    nome: z.string().trim().min(1, 'Il nome è obbligatorio').max(80).optional(),
    salvaInRubrica: z.boolean().default(false),
    categoria: z.enum(CATEGORIE_PERSONA).default('adulto'),
    stato: z.enum(STATI_PRESENZA).default('in_attesa'),
    note: TestoBreve.default(''),
  })
  .refine((d) => [d.utenteId, d.esternoId, d.nome].filter((x) => x !== undefined).length === 1, 'Indica una persona: dall\'app, dalla rubrica o un nome')
export type NuovoPartecipante = z.infer<typeof SchemaNuovoPartecipante>

export const SchemaAggiornaPartecipante = z.object({
  nome: z.string().trim().min(1, 'Il nome è obbligatorio').max(80),
  categoria: z.enum(CATEGORIE_PERSONA),
  stato: z.enum(STATI_PRESENZA),
  note: TestoBreve,
  versione: Versione,
})
export type AggiornaPartecipante = z.infer<typeof SchemaAggiornaPartecipante>

export const SchemaAccompagnatori = z.object({ anonimi: SchemaAnonimi, versione: Versione })

export const SchemaCoperti = z.object({
  automatici: z.boolean(),
  /** Numeri manuali (tornando al manuale si possono copiare i calcolati). */
  adulti: z.number().int().min(0).max(999),
  bambini: z.number().int().min(0).max(999),
  maxAccompagnatori: z.number().int().min(0).max(99).nullable(),
  versione: Versione,
})
export type ImpostaCoperti = z.infer<typeof SchemaCoperti>
