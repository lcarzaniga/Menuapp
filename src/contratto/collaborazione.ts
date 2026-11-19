// Collaborazione sulle ricette (SPEC §41): proposte di modifica, decisioni per singola modifica,
// cronologia, trasferimento della proprietà.
import { z } from 'zod'
import { Epoch, Id, TestoBreve, Versione } from './comune.ts'
import { SchemaFoto } from './foto.ts'
import { SchemaAggiornaPiatto } from './ricettario.ts'

export const STATI_MODIFICA = ['in_attesa', 'approvata', 'rifiutata', 'ritirata'] as const
const Persona = z.object({ id: Id.nullable(), nome: z.string() })

export const SchemaModifica = z.object({
  id: Id,
  campo: z.string(),
  operazione: z.enum(['modifica', 'aggiungi', 'rimuovi']),
  chiave: z.string().nullable(),
  /** Valore ufficiale quando la proposta è nata. */
  prima: z.unknown(),
  /** Valore proposto. */
  dopo: z.unknown(),
  /** Valore ufficiale adesso (per confrontarlo con quello proposto). */
  attuale: z.unknown(),
  dipendeDa: Id.nullable(),
  stato: z.enum(STATI_MODIFICA),
  /** In attesa ma toccata da un cambiamento della ricetta: si approva solo con una conferma. */
  conflitto: z.boolean(),
  motivo: z.string(),
  foto: SchemaFoto.nullable(),
})
export type Modifica = z.infer<typeof SchemaModifica>

export const SchemaProposta = z.object({
  id: Id,
  piattoId: Id,
  autore: Persona,
  versioneBase: z.number().int(),
  motivazione: z.string(),
  stato: z.enum(['in_attesa', 'conclusa', 'ritirata']),
  modifiche: z.array(SchemaModifica),
  chiarimenti: z.array(z.object({ autore: Persona, testo: z.string(), il: Epoch })),
  decisoDa: Persona.nullable(),
  decisoIl: Epoch.nullable(),
  /** L'utente corrente decide (proprietario) o è l'autore. */
  puoDecidere: z.boolean(),
  puoRitirare: z.boolean(),
  versione: Versione,
  creatoIl: Epoch,
})
export type Proposta = z.infer<typeof SchemaProposta>

export const SchemaProposte = z.object({
  proposte: z.array(SchemaProposta),
  /** Versione della ricetta ufficiale: le decisioni la riportano (controllo di concorrenza). */
  versionePiatto: Versione,
})
export type Proposte = z.infer<typeof SchemaProposte>

export const SchemaNuovaProposta = z.object({
  id: Id,
  /** Versione della ricetta su cui è stata preparata: deve essere quella attuale. */
  versioneBase: Versione,
  contenuto: SchemaAggiornaPiatto.omit({ versione: true }),
  motivazione: z.string().trim().max(2000).default(''),
  /** Foto ufficiali che si propone di togliere. */
  rimuoviFoto: z.array(Id).max(20).default([]),
  /** Seguiranno foto da aggiungere: la proposta può nascere senza altre modifiche. */
  conFoto: z.boolean().default(false),
})

export const SchemaQueryFotoProposta = z.object({
  id: Id,
  didascalia: TestoBreve.optional().default(''),
  passo: z.coerce.number().int().min(0).max(99).optional(),
})

export const SchemaDecisioni = z.object({
  versione: Versione,
  versionePiatto: Versione,
  decisioni: z
    .array(
      z.object({
        modificaId: Id,
        esito: z.enum(['approvata', 'rifiutata']),
        motivo: z.string().trim().max(1000).default(''),
        /** Approvare una modifica in conflitto richiede una conferma esplicita. */
        confermaConflitto: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(500),
})
export type Decisioni = z.infer<typeof SchemaDecisioni>

export const SchemaChiarimento = z.object({ testo: z.string().trim().min(1).max(2000) })

// ── Cronologia ──────────────────────────────────────────────

export const SchemaRevisione = z.object({
  id: Id,
  numero: z.number().int(),
  tipo: z.enum(['iniziale', 'modifica', 'proposta', 'ripristino', 'foto', 'trasferimento', 'riassegnazione']),
  autore: Persona,
  approvatoDa: Persona.nullable(),
  propostaId: Id.nullable(),
  ripristinaNumero: z.number().int().nullable(),
  campi: z.array(z.object({ campo: z.string(), prima: z.unknown(), dopo: z.unknown() })),
  /** Si può tornare a questa versione (ha un contenuto ed è il proprietario a chiederlo). */
  ripristinabile: z.boolean(),
  motivazione: z.string(),
  creatoIl: Epoch,
})
export type Revisione = z.infer<typeof SchemaRevisione>
export const SchemaCronologia = z.object({ revisioni: z.array(SchemaRevisione), versionePiatto: Versione })
export type Cronologia = z.infer<typeof SchemaCronologia>
export const SchemaRipristina = z.object({ revisioneId: Id, versione: Versione })

// ── Proprietà ───────────────────────────────────────────────

export const SchemaTrasferimento = z.object({
  id: Id,
  piattoId: Id,
  tipo: z.enum(['volontario', 'amministrativo']),
  da: Persona,
  a: Persona,
  motivazione: z.string(),
  stato: z.enum(['in_attesa', 'accettato', 'rifiutato', 'annullato']),
  creatoDa: Persona,
  creatoIl: Epoch,
  versione: Versione,
})
export type Trasferimento = z.infer<typeof SchemaTrasferimento>

export const SchemaNuovoTrasferimento = z.object({ id: Id, a: Id, versionePiatto: Versione })
export const SchemaRiassegnazione = z.object({ id: Id, a: Id, motivazione: z.string().trim().min(1, 'Serve una motivazione').max(1000) })
export const SchemaDecisioneTrasferimento = z.object({ esito: z.enum(['accetta', 'rifiuta', 'annulla']), versione: Versione })

/** Collaborazione vista dalla scheda della ricetta. */
export const SchemaCollaborazione = z.object({
  /** Può proporre modifiche (Famiglia della ricetta o condivisione personale; non il proprietario). */
  puoProporre: z.boolean(),
  /** Proposte in attesa visibili all'utente (tutte per il proprietario, le sue per gli altri). */
  proposteInAttesa: z.number().int(),
  /** Può vedere la cronologia (chi fa parte della ricetta). */
  vedeCronologia: z.boolean(),
  /** Trasferimento in attesa che riguarda l'utente (inviato o ricevuto). */
  trasferimento: SchemaTrasferimento.nullable(),
  /** Membri a cui il proprietario può trasferirla (Famiglia con cui è condivisa). */
  destinatari: z.array(z.object({ id: Id, nome: z.string() })),
  /** L'utente amministra la Famiglia della ricetta e può riassegnarla (non è il proprietario). */
  puoRiassegnare: z.boolean(),
})
export type Collaborazione = z.infer<typeof SchemaCollaborazione>
