// Contratto API: duplicazione degli eventi, ricorrenze, riepilogo e confronto (SPEC §25–§28).
import { z } from 'zod'
import { SchemaEvento, SchemaSceltaRicorrenza } from './eventi.ts'
import { DataISO, Id, NomeObbligatorio, TestoBreve, Versione } from './comune.ts'

export const SchemaDuplica = z.object({
  /** Id del nuovo evento (scelto dal client: la ripetizione della richiesta non duplica due volte). */
  id: Id,
  nome: NomeObbligatorio,
  data: DataISO,
  /** Famiglia del nuovo evento (verificata); assente: quella dell'originale, se ne fai parte. */
  gruppoId: Id.nullable().optional(),
  copiaPartecipanti: z.boolean().default(false),
  /**
   * Ricorrenza della copia (della sua Famiglia o standard), `null` nessuna; assente: quella
   * dell'originale (una standard sempre, una della Famiglia se la Famiglia è la stessa).
   */
  ricorrenza: SchemaSceltaRicorrenza.nullable().optional(),
  /** Forma precedente (solo ricorrenze della Famiglia), accettata per i client non aggiornati. */
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
  /** Ricorrenza dell'evento (null: nessuna): della Famiglia o standard (SPEC §30). */
  ricorrenza: z.object({ tipo: z.enum(['famiglia', 'standard']), id: Id, nome: z.string() }).nullable(),
  /** Ricorrenza standard proposta dall'occasione, finché nessuno ha scelto (solo a chi può associare). */
  suggerita: z.object({ id: Id, nome: z.string() }).nullable(),
  /** Catalogo delle ricorrenze standard, per sceglierne una (solo a chi può associare). */
  standard: z.array(z.object({ id: Id, nome: z.string() })),
  /** Altri eventi della stessa ricorrenza che l'utente può vedere, in ordine di data. */
  edizioni: z.array(SchemaEdizione),
  /** Altri eventi della stessa Famiglia visibili all'utente, da confrontare a mano. */
  altriEventi: z.array(SchemaEdizione),
  /** Ricorrenze della Famiglia dell'evento, per sceglierne una (solo a chi può modificare e ne fa parte). */
  ricorrenze: z.array(z.object({ id: Id, nome: z.string() })),
  puoAssociare: z.boolean(),
})
export type Edizioni = z.infer<typeof SchemaEdizioni>

/**
 * Associa l'evento a una ricorrenza (della Famiglia o standard), oppure la toglie con null.
 * `ricorrenzaId` è la forma precedente (solo ricorrenze della Famiglia).
 */
export const SchemaAssociaRicorrenza = z.union([z.object({ ricorrenza: SchemaSceltaRicorrenza.nullable() }), z.object({ ricorrenzaId: Id.nullable() })])

// ── Riepilogo «A che punto siamo?» (SPEC §26) ───────────────
// Ogni parte è null quando la funzione non è usata nell'evento: niente indicatori vuoti.

export const SchemaRiepilogoEvento = z.object({
  /** Piatti nel menù: zero è una cosa da fare, non «tutto pronto» (SPEC §31.2). */
  menu: z.object({ voci: z.number().int() }),
  coperti: z.object({ equivalenti: z.number(), adulti: z.number().int(), bambini: z.number().int(), automatici: z.boolean() }),
  partecipanti: z.object({ confermati: z.number().int(), inAttesa: z.number().int(), assenti: z.number().int() }).nullable(),
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

// ── «Per te» (SPEC §31.3) ───────────────────────────────────

export const SchemaPerTe = z.object({
  /** Piatti e cose affidati all'utente e non ancora fatti, negli eventi in corso. */
  incarichi: z.array(z.object({ tipo: z.enum(['voce', 'cosa']), id: Id, nome: z.string(), evento: z.string(), data: DataISO, collegamento: z.string() })),
  /** Sondaggi aperti a cui l'utente non ha ancora risposto. */
  sondaggi: z.array(z.object({ id: Id, testo: z.string(), dove: z.string(), collegamento: z.string() })),
})
export type PerTe = z.infer<typeof SchemaPerTe>
