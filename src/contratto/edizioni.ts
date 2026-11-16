// Contratto API: duplicazione degli eventi, edizioni di una ricorrenza, riepilogo e confronto
// (SPEC §25–§27).
import { z } from 'zod'
import { SchemaEvento } from './eventi.ts'
import { DataISO, Id, NomeObbligatorio } from './comune.ts'

export const SchemaDuplica = z.object({
  /** Id del nuovo evento (scelto dal client: la ripetizione della richiesta non duplica due volte). */
  id: Id,
  nome: NomeObbligatorio,
  data: DataISO,
  /** Famiglia del nuovo evento (verificata); assente: quella dell'originale, se ne fai parte. */
  gruppoId: Id.nullable().optional(),
  copiaPartecipanti: z.boolean().default(false),
  /** Collega la copia alla stessa serie dell'originale (stessa Famiglia). */
  collegaSerie: z.boolean().default(true),
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

export const SchemaEdizioni = z.object({
  serieId: Id.nullable(),
  /** Altre edizioni della serie che l'utente può vedere, dalla più vecchia. */
  edizioni: z.array(SchemaEdizione),
  /** Eventi della stessa Famiglia visibili all'utente, da collegare o confrontare a mano. */
  altriEventi: z.array(SchemaEdizione),
  puoCollegare: z.boolean(),
})
export type Edizioni = z.infer<typeof SchemaEdizioni>

/** Collega l'evento alla serie di un altro (stessa Famiglia), oppure lo scollega con null. */
export const SchemaSerie = z.object({ conEventoId: Id.nullable() })
