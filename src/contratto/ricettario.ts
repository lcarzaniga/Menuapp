// Contratto API: piatti, ingredienti del catalogo, reparti (SPEC §12.4).
import { z } from 'zod'
import { SCALATURE, STATI_PARSING } from '../domain/tipi.ts'
import { CODICI_UNITA } from '../domain/unita.ts'
import { Epoch, Id, NomeObbligatorio, TestoBreve, TestoLungo, Versione } from './comune.ts'
import { SchemaFoto } from './foto.ts'
import { SchemaPersona } from './accesso.ts'

export const VISIBILITA_PIATTO = ['famiglia', 'privata'] as const
export type VisibilitaPiatto = (typeof VISIBILITA_PIATTO)[number]
export const SchemaVisibilita = z.object({ visibilita: z.enum(VISIBILITA_PIATTO) })
export const SchemaFamigliePiatto = z.object({ gruppi: z.array(Id).max(20) })

const Minuti = z.number().int().min(0).max(100_000).nullable()
const Quantita = z.number().min(0).max(1_000_000).nullable()

export const SchemaIngredientePiatto = z
  .object({
    id: Id,
    ordine: z.number().int().min(0),
    testoOriginale: z.string().max(500),
    nome: z.string().trim().min(1, 'Nome dell\'ingrediente mancante').max(200),
    ingredienteId: Id.nullable(),
    quantita: Quantita,
    quantitaMax: Quantita,
    unita: z.enum(CODICI_UNITA).nullable(),
    scalatura: z.enum(SCALATURE),
    facoltativo: z.boolean(),
    nota: TestoBreve,
    statoParsing: z.enum(STATI_PARSING),
    problemiParsing: z.array(z.string().max(300)).max(20),
  })
  .refine((i) => i.quantitaMax === null || (i.quantita !== null && i.quantitaMax >= i.quantita), {
    message: 'Il massimo dell\'intervallo deve essere maggiore del minimo',
    path: ['quantitaMax'],
  })
  .refine((i) => i.unita !== 'qb' || i.quantita === null, { message: 'Con «q.b.» non si indica la quantità', path: ['quantita'] })

const CampiPiatto = {
  nome: NomeObbligatorio,
  portataSuggerita: TestoBreve.nullable(),
  porzioniBase: z.number().positive('Le porzioni devono essere più di zero').max(10_000).nullable(),
  tempoPreparazioneMin: Minuti,
  tempoCotturaMin: Minuti,
  tempoRiposoMin: Minuti,
  attrezzature: z.array(z.string().trim().min(1).max(200)).max(50),
  procedimento: z.array(z.string().trim().min(1).max(5000)).max(100),
  note: TestoLungo,
  fonte: TestoBreve,
  ingredienti: z.array(SchemaIngredientePiatto).max(200),
}

export const SchemaPiatto = z.object({ id: Id, ...CampiPiatto, versione: Versione, creatoIl: Epoch, aggiornatoIl: Epoch })

export const SchemaUsoPiatto = z.object({ eventoId: Id, eventoNome: z.string(), data: z.string(), stato: z.string(), voceId: Id, voceNome: z.string() })
/** Proprietà della ricetta vista dall'utente corrente (SPEC §19.4). */
const CampiProprieta = {
  proprietario: SchemaPersona,
  /** true se la ricetta è dell'utente corrente (può modificarla). */
  mio: z.boolean(),
  /** Autore della ricetta originale, se è una copia di una ricetta altrui. */
  origineAutore: z.string(),
  /** Ricettario di famiglia (visibile a tutti) o privata (solo proprietario e condivisioni). */
  visibilita: z.enum(VISIBILITA_PIATTO),
}

export const SchemaDettaglioPiatto = SchemaPiatto.extend({
  usatoIn: z.array(SchemaUsoPiatto),
  foto: z.array(SchemaFoto),
  ...CampiProprieta,
  originePiattoId: Id.nullable(),
  /** Famiglie con cui è condivisa (solo per il proprietario). */
  famiglie: z.array(SchemaPersona),
  /** Con chi è condivisa una ricetta privata (solo per il proprietario). */
  condivisaCon: z.array(SchemaPersona),
})
export type DettaglioPiatto = z.infer<typeof SchemaDettaglioPiatto>

export const SchemaRiepilogoPiatto = z.object({
  id: Id,
  nome: z.string(),
  portataSuggerita: z.string().nullable(),
  porzioniBase: z.number().nullable(),
  numeroIngredienti: z.number().int(),
  daVerificare: z.number().int(),
  usi: z.number().int(),
  fotoPrincipale: Id.nullable(),
  versione: Versione,
  aggiornatoIl: Epoch,
  ...CampiProprieta,
  /** Ricetta privata che il proprietario condivide con qualcuno. */
  condiviso: z.boolean(),
})
export type RiepilogoPiatto = z.infer<typeof SchemaRiepilogoPiatto>

export const SchemaNuovoPiatto = z.object({
  id: Id,
  visibilita: z.enum(VISIBILITA_PIATTO).optional(),
  /** Famiglie con cui condividerla (di cui l'autore fa parte). Assente: tutte le sue, salvo `privata`. */
  famiglie: z.array(Id).max(20).optional(),
  nome: NomeObbligatorio,
  portataSuggerita: CampiPiatto.portataSuggerita.optional(),
  porzioniBase: CampiPiatto.porzioniBase.optional(),
  tempoPreparazioneMin: Minuti.optional(),
  tempoCotturaMin: Minuti.optional(),
  tempoRiposoMin: Minuti.optional(),
  attrezzature: CampiPiatto.attrezzature.optional(),
  procedimento: CampiPiatto.procedimento.optional(),
  note: TestoLungo.optional(),
  fonte: TestoBreve.optional(),
  ingredienti: CampiPiatto.ingredienti.optional(),
})
export type NuovoPiatto = z.infer<typeof SchemaNuovoPiatto>

export const SchemaAggiornaPiatto = z.object({ ...CampiPiatto, versione: Versione })
export type AggiornaPiatto = z.infer<typeof SchemaAggiornaPiatto>

/** «Crea nel ricettario» da una voce di menù (SPEC F3). */
export const SchemaCreaPiattoDaVoce = z.object({ piattoId: Id, versione: Versione })

// ── Catalogo ingredienti ────────────────────────────────────

export const SchemaIngrediente = z.object({
  id: Id,
  nome: z.string(),
  sinonimi: z.array(z.string()),
  repartoId: Id,
  unitaPreferita: z.enum(CODICI_UNITA).nullable(),
  scalaturaAbituale: z.enum(SCALATURE),
  versione: Versione,
  creatoIl: Epoch,
  aggiornatoIl: Epoch,
})

const CampiIngrediente = {
  nome: NomeObbligatorio,
  sinonimi: z.array(z.string().trim().min(1).max(200)).max(30),
  repartoId: Id,
  unitaPreferita: z.enum(CODICI_UNITA).nullable(),
  scalaturaAbituale: z.enum(SCALATURE),
}

export const SchemaNuovoIngrediente = z.object({ id: Id, ...CampiIngrediente })
export type NuovoIngrediente = z.infer<typeof SchemaNuovoIngrediente>
export const SchemaAggiornaIngrediente = z.object({ ...CampiIngrediente, versione: Versione })
export type AggiornaIngrediente = z.infer<typeof SchemaAggiornaIngrediente>

export const SchemaUsoIngrediente = z.object({ piatti: z.array(z.object({ id: Id, nome: z.string() })) })
