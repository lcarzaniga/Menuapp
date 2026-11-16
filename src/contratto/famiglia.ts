// Contratto API dello spazio della famiglia (SPEC §20): bacheche, sondaggi, proposte di
// piatti, chi porta cosa, notifiche, valutazioni.
import { z } from 'zod'
import { Epoch, Id, NomeObbligatorio, TestoBreve, Versione } from './comune.ts'
import { SchemaPersona } from './accesso.ts'

export const REAZIONI = ['mi_piace', 'cuore', 'risata', 'gnam', 'applauso'] as const
export type Reazione = (typeof REAZIONI)[number]
export const SIMBOLI_REAZIONE: Record<Reazione, string> = { mi_piace: '👍', cuore: '❤️', risata: '😄', gnam: '😋', applauso: '👏' }

export const MASSIMO_ALLEGATI = 4
const TestoMessaggio = z.string().max(5000, 'Al massimo 5000 caratteri')

// ── Gruppi ───────────────────────────────────────────────────

export const SchemaGruppo = z.object({ id: Id, nome: z.string(), ruolo: z.enum(['amministratore', 'membro']), membri: z.array(SchemaPersona) })
export type Gruppo = z.infer<typeof SchemaGruppo>

// ── Messaggi ─────────────────────────────────────────────────

export const RISULTATI_SONDAGGIO = ['sempre', 'dopo_voto', 'alla_chiusura'] as const

export const SchemaNuovoSondaggio = z.object({
  opzioni: z.array(z.string().trim().min(1, 'Opzione vuota').max(200)).min(2, 'Servono almeno due opzioni').max(12),
  multipla: z.boolean().default(false),
  risultati: z.enum(RISULTATI_SONDAGGIO).default('dopo_voto'),
  scadeIl: Epoch.nullable().default(null),
})

export const SchemaNuovaProposta = z.object({
  nome: NomeObbligatorio,
  piattoId: Id.nullable().default(null),
  portataNome: TestoBreve.default(''),
})

export const SchemaNuovoMessaggio = z
  .object({
    id: Id,
    testo: TestoMessaggio,
    piattoId: Id.nullable().default(null),
    sondaggio: SchemaNuovoSondaggio.optional(),
    proposta: SchemaNuovaProposta.optional(),
  })
  .refine((m) => !(m.sondaggio && m.proposta), { message: 'Un messaggio è un sondaggio oppure una proposta' })
  .refine((m) => m.testo.trim() !== '' || m.proposta || m.piattoId, { message: 'Scrivi qualcosa', path: ['testo'] })
export type NuovoMessaggio = z.infer<typeof SchemaNuovoMessaggio>

export const SchemaAggiornaMessaggio = z.object({ testo: TestoMessaggio, versione: Versione })
export const SchemaFissa = z.object({ fissato: z.boolean() })
export const SchemaNuovoCommento = z.object({ id: Id, testo: z.string().trim().min(1, 'Scrivi qualcosa').max(2000) })
export const SchemaAggiornaCommento = z.object({ testo: z.string().trim().min(1).max(2000), versione: Versione })
export const SchemaVoto = z.object({ opzioni: z.array(Id).max(12) })
export const SchemaDecisione = z.object({ stato: z.enum(['in_valutazione', 'accettata', 'rifiutata']) })
export const SchemaInserisciProposta = z.object({ portataId: Id })

const SchemaSchedaPiatto = z.object({ id: Id, nome: z.string(), fotoPrincipale: Id.nullable(), proprietario: z.string() })

export const SchemaCommento = z.object({
  id: Id,
  autore: SchemaPersona,
  testo: z.string(),
  creatoIl: Epoch,
  modificatoIl: Epoch.nullable(),
  versione: Versione,
  puoModificare: z.boolean(),
})
export type Commento = z.infer<typeof SchemaCommento>

export const SchemaSondaggio = z.object({
  multipla: z.boolean(),
  risultati: z.enum(RISULTATI_SONDAGGIO),
  scadeIl: Epoch.nullable(),
  chiuso: z.boolean(),
  /** Risultati visibili a questo utente (secondo la regola scelta dall'autore). */
  risultatiVisibili: z.boolean(),
  votanti: z.number().int().nullable(),
  opzioni: z.array(z.object({ id: Id, testo: z.string(), voti: z.number().int().nullable(), nomi: z.array(z.string()) })),
  mieScelte: z.array(Id),
  puoVotare: z.boolean(),
  puoChiudere: z.boolean(),
})

export const STATI_PROPOSTA = ['in_valutazione', 'accettata', 'rifiutata'] as const
export const SchemaProposta = z.object({
  nome: z.string(),
  piatto: SchemaSchedaPiatto.nullable(),
  portataNome: z.string(),
  stato: z.enum(STATI_PROPOSTA),
  voceId: Id.nullable(),
  decisoDa: z.string().nullable(),
  puoDecidere: z.boolean(),
})

export const SchemaMessaggio = z.object({
  id: Id,
  ambito: z.object({ tipo: z.enum(['gruppo', 'evento']), id: Id }),
  tipo: z.enum(['messaggio', 'sondaggio', 'proposta']),
  autore: SchemaPersona,
  testo: z.string(),
  fissato: z.boolean(),
  creatoIl: Epoch,
  modificatoIl: Epoch.nullable(),
  versione: Versione,
  /** Ricetta segnalata, solo se chi legge può vederla. */
  piatto: SchemaSchedaPiatto.nullable(),
  /** C'era una ricetta, ma chi legge non può vederla. */
  piattoNascosto: z.boolean(),
  allegati: z.array(Id),
  reazioni: z.array(z.object({ reazione: z.enum(REAZIONI), numero: z.number().int(), mia: z.boolean(), nomi: z.array(z.string()) })),
  commenti: z.array(SchemaCommento),
  sondaggio: SchemaSondaggio.nullable(),
  proposta: SchemaProposta.nullable(),
  puoModificare: z.boolean(),
  puoEliminare: z.boolean(),
  puoFissare: z.boolean(),
})
export type Messaggio = z.infer<typeof SchemaMessaggio>

export const SchemaBacheca = z.object({
  messaggi: z.array(SchemaMessaggio),
  /** Chi legge può scrivere (partecipazione). */
  puoScrivere: z.boolean(),
})
export type Bacheca = z.infer<typeof SchemaBacheca>

// ── Chi porta cosa ──────────────────────────────────────────

export const STATI_INCARICO = ['da_assegnare', 'assegnato', 'completato'] as const
export type StatoIncarico = (typeof STATI_INCARICO)[number]

export const SchemaIncarico = z.object({
  tipo: z.enum(['voce', 'cosa']),
  id: Id,
  nome: z.string(),
  portata: z.string().nullable(),
  quantita: z.string(),
  note: z.string(),
  incaricato: z.string(),
  incaricatoId: Id.nullable(),
  stato: z.enum(STATI_INCARICO),
  inSpesa: z.boolean().nullable(),
  spesaToltaDaIncarico: z.boolean(),
  versione: Versione,
  puoPrendere: z.boolean(),
  puoRinunciare: z.boolean(),
  puoCompletare: z.boolean(),
  puoGestire: z.boolean(),
})
export type Incarico = z.infer<typeof SchemaIncarico>

export const SchemaIncarichi = z.object({ incarichi: z.array(SchemaIncarico), puoPartecipare: z.boolean(), puoAssegnare: z.boolean(), persone: z.array(SchemaPersona) })
export type Incarichi = z.infer<typeof SchemaIncarichi>

export const SchemaNuovaCosa = z.object({ id: Id, nome: NomeObbligatorio, quantita: TestoBreve.default(''), note: TestoBreve.default(''), prendo: z.boolean().default(false) })
export const SchemaAggiornaCosa = z.object({ nome: NomeObbligatorio, quantita: TestoBreve, note: TestoBreve, versione: Versione })
export const SchemaPrendi = z.object({ versione: Versione, togliDallaSpesa: z.boolean().default(false) })
export const SchemaAssegna = z.object({ versione: Versione, utenteId: Id.nullable() })
export const SchemaCompleta = z.object({ versione: Versione, completato: z.boolean() })

// ── Notifiche ───────────────────────────────────────────────

export const TIPI_NOTIFICA = [
  'bacheca_famiglia',
  'bacheca_evento',
  'risposta',
  'sondaggio',
  'proposta',
  'esito_proposta',
  'incarico',
  'menu',
  'condivisione',
  'valutazione',
] as const
export type TipoNotifica = (typeof TIPI_NOTIFICA)[number]

export const NOMI_NOTIFICA: Record<TipoNotifica, string> = {
  bacheca_famiglia: 'Nuovi messaggi nella bacheca della famiglia',
  bacheca_evento: 'Nuovi messaggi nelle bacheche degli eventi',
  risposta: 'Commenti ai miei messaggi',
  sondaggio: 'Sondaggi nuovi e chiusi',
  proposta: 'Nuove proposte di piatti',
  esito_proposta: 'Le mie proposte accettate o rifiutate',
  incarico: 'Chi porta cosa (assegnazioni e rinunce)',
  menu: 'Modifiche importanti ai menù',
  condivisione: 'Eventi e ricette condivisi con me',
  valutazione: 'Valutazioni dei piatti che ho preparato',
}

export const SchemaNotifica = z.object({
  id: Id,
  tipo: z.enum(TIPI_NOTIFICA),
  titolo: z.string(),
  testo: z.string(),
  attore: z.string().nullable(),
  conteggio: z.number().int(),
  collegamento: z.string(),
  letta: z.boolean(),
  aggiornatoIl: Epoch,
})
export type Notifica = z.infer<typeof SchemaNotifica>

export const SchemaPreferenze = z.object({ disattivate: z.array(z.enum(TIPI_NOTIFICA)) })

// ── Valutazioni ─────────────────────────────────────────────

export const SchemaValuta = z.object({ stelle: z.number().int().min(1).max(5) })

export const SchemaValutazioniEvento = z.object({
  valutabile: z.boolean(),
  voci: z.array(z.object({ voceId: Id, media: z.number().nullable(), numero: z.number().int(), mie: z.number().int().nullable() })),
})
export type ValutazioniEvento = z.infer<typeof SchemaValutazioniEvento>

export const SchemaVoceClassifica = z.object({
  chiave: z.string(),
  nome: z.string(),
  portata: z.string(),
  ricettaId: Id.nullable(),
  media: z.number(),
  punteggio: z.number(),
  numero: z.number().int(),
  eventi: z.number().int(),
})
export type VoceClassifica = z.infer<typeof SchemaVoceClassifica>
