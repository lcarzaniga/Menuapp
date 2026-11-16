// Contratto API: duplicazione degli eventi, ricorrenze, riepilogo e confronto (SPEC §25–§28).
import { z } from 'zod'
import { SchemaEvento } from './eventi.ts'
import { DataISO, Id, NomeObbligatorio, TestoBreve, Versione } from './comune.ts'

export const SchemaDuplica = z.object({
  /** Id del nuovo evento (scelto dal client: la ripetizione della richiesta non duplica due volte). */
  id: Id,
  nome: NomeObbligatorio,
  data: DataISO,
  /** Famiglia del nuovo evento (verificata); assente: quella dell'originale, se ne fai parte. */
  gruppoId: Id.nullable().optional(),
  copiaPartecipanti: z.boolean().default(false),
  /** Ricorrenza della copia (della sua Famiglia); assente: quella dell'originale se la Famiglia è la stessa. */
  ricorrenzaId: Id.nullable().optional(),
})
export type Duplica = z.infer<typeof SchemaDuplica>

export const SchemaEsitoDuplica = z.object({
  evento: SchemaEvento,
  /** Cose da sapere: ricette non disponibili, ricreate dall'archivio, persone scollegate… */
  avvisi: z.array(z.string()),
})
export type EsitoDuplica = z.infer<typeof SchemaEsitoDuplica>

export const SchemaEdizione = z.object({ id: Id, nome: z.string(), data: DataISO, stato: z.string() })
export type Edizione = z.infer<typeof SchemaEdizione>

// ── Ricorrenze (SPEC §28) ───────────────────────────────────

export const SchemaRicorrenza = z.object({ id: Id, nome: z.string(), descrizione: z.string(), eventi: z.number().int(), versione: Versione })
export type Ricorrenza = z.infer<typeof SchemaRicorrenza>
const NomeRicorrenza = NomeObbligatorio.max(80)
export const SchemaNuovaRicorrenza = z.object({ id: Id, nome: NomeRicorrenza, descrizione: TestoBreve.default('') })
export const SchemaAggiornaRicorrenza = z.object({ nome: NomeRicorrenza, descrizione: TestoBreve, versione: Versione })

export const SchemaEdizioni = z.object({
  /** Ricorrenza dell'evento (null: nessuna). */
  ricorrenza: z.object({ id: Id, nome: z.string() }).nullable(),
  /** Altri eventi della stessa ricorrenza che l'utente può vedere, in ordine di data. */
  edizioni: z.array(SchemaEdizione),
  /** Altri eventi della stessa Famiglia visibili all'utente, da confrontare a mano. */
  altriEventi: z.array(SchemaEdizione),
  /** Ricorrenze della Famiglia dell'evento, per sceglierne una (solo a chi può modificare e ne fa parte). */
  ricorrenze: z.array(z.object({ id: Id, nome: z.string() })),
  puoAssociare: z.boolean(),
})
export type Edizioni = z.infer<typeof SchemaEdizioni>

/** Associa l'evento a una ricorrenza della sua Famiglia, oppure la toglie con null. */
export const SchemaAssociaRicorrenza = z.object({ ricorrenzaId: Id.nullable() })

// ── Riepilogo «A che punto siamo?» (SPEC §26) ───────────────
// Ogni parte è null quando la funzione non è usata nell'evento: niente indicatori vuoti.

export const SchemaRiepilogoEvento = z.object({
  coperti: z.object({ equivalenti: z.number(), adulti: z.number().int(), bambini: z.number().int(), automatici: z.boolean() }),
  partecipanti: z.object({ confermati: z.number().int(), inAttesa: z.number().int(), assenti: z.number().int() }).nullable(),
  /** Stato del proprio invito, se l'utente è fra i partecipanti. */
  mioInvito: z.enum(['in_attesa', 'confermato', 'assente']).nullable(),
  incarichi: z
    .object({
      /** Cose da portare ancora senza nessuno: aggiunte apposta per essere portate. */
      coseSenzaResponsabile: z.number().int(),
      /** Affidati e non ancora segnati come fatti. */
      daCompletare: z.number().int(),
      /** Piatti del menù non affidati: solo un'informazione (li può preparare chi organizza). */
      piattiNonAffidati: z.number().int(),
      /** Responsabili che hanno detto che non vengono. */
      responsabiliAssenti: z.number().int(),
    })
    .nullable(),
  attivita: z.object({ daFare: z.number().int(), inRitardo: z.number().int() }).nullable(),
  proposte: z.object({ inAttesa: z.number().int() }).nullable(),
  sondaggi: z.object({ aperti: z.number().int() }).nullable(),
  spesa: z.object({ daComprare: z.number().int(), daVerificare: z.number().int(), avvisi: z.number().int() }).nullable(),
  /** Evento archiviato: solo coperti e partecipanti. */
  archiviato: z.boolean(),
})
export type RiepilogoOrganizzativo = z.infer<typeof SchemaRiepilogoEvento>

// ── Confronto fra edizioni (SPEC §27) ───────────────────────

const SchemaValutazione = z.object({ media: z.number(), numero: z.number().int() }).nullable()
const SchemaPiattoConfronto = z.object({ nome: z.string(), portata: z.string(), porzioni: z.number(), valutazione: SchemaValutazione })
const SchemaLatoConfronto = z.object({
  id: Id,
  nome: z.string(),
  data: DataISO,
  archiviato: z.boolean(),
  coperti: z.object({ equivalenti: z.number(), adulti: z.number().int(), bambini: z.number().int(), automatici: z.boolean() }),
  /** Persone confermate (null: l'evento non aveva l'elenco dei partecipanti). */
  partecipanti: z.object({ confermati: z.number().int(), inAttesa: z.number().int(), assenti: z.number().int() }).nullable(),
  portate: z.array(z.string()),
})

export const SchemaConfronto = z.object({
  ora: SchemaLatoConfronto,
  prima: SchemaLatoConfronto,
  mantenuti: z.array(
    z.object({
      ora: SchemaPiattoConfronto,
      prima: SchemaPiattoConfronto,
      /** certa: stessa ricetta (anche copia); incerta: solo lo stesso nome. */
      corrispondenza: z.enum(['certa', 'incerta']),
    }),
  ),
  /** omonimo: un piatto con lo stesso nome c'era (o c'è) ma è una ricetta diversa. */
  aggiunti: z.array(SchemaPiattoConfronto.extend({ omonimo: z.boolean() })),
  nonRiproposti: z.array(SchemaPiattoConfronto.extend({ omonimo: z.boolean() })),
  portate: z.object({ aggiunte: z.array(z.string()), tolte: z.array(z.string()) }),
})
export type Confronto = z.infer<typeof SchemaConfronto>
