// Contratto API: utenti, dispositivi autorizzati su invito, sessioni e condivisioni (SPEC §19).
import { z } from 'zod'
import { Epoch, Id, NomeObbligatorio, Versione } from './comune.ts'

export const RUOLI = ['amministratore', 'utente'] as const
export type Ruolo = (typeof RUOLI)[number]
export const STATI_UTENTE = ['attivo', 'sospeso'] as const
export const PERMESSI_EVENTO = ['lettura', 'modifica'] as const
export type PermessoCondivisione = (typeof PERMESSI_EVENTO)[number]
/** Permesso effettivo dell'utente corrente su un evento. */
export type PermessoEvento = PermessoCondivisione | 'proprietario'

/** Ingresso da cui arriva la richiesta: le funzioni di sistema solo da quello privato. */
export const INGRESSI = ['privato', 'pubblico'] as const
export type Ingresso = (typeof INGRESSI)[number]

export const SchemaUtente = z.object({
  id: Id,
  nome: z.string(),
  ruolo: z.enum(RUOLI),
  stato: z.enum(STATI_UTENTE),
  versione: Versione,
  creatoIl: Epoch,
  aggiornatoIl: Epoch,
})
export type Utente = z.infer<typeof SchemaUtente>

/** Utente come lo vedono gli altri (per scegliere con chi condividere). */
export const SchemaPersona = z.object({ id: Id, nome: z.string() })
export type Persona = z.infer<typeof SchemaPersona>

export const SchemaSessioneCorrente = z.object({
  utente: SchemaUtente,
  sessioneId: Id,
  ingresso: z.enum(INGRESSI),
})
export type SessioneCorrente = z.infer<typeof SchemaSessioneCorrente>

export const SchemaSessione = z.object({
  id: Id,
  utenteId: Id,
  utenteNome: z.string(),
  dispositivo: z.string(),
  agente: z.string(),
  creatoIl: Epoch,
  ultimoUso: Epoch,
  scadeIl: Epoch,
  corrente: z.boolean(),
})
export type Sessione = z.infer<typeof SchemaSessione>

export const STATI_RICHIESTA = ['in_attesa', 'approvata', 'rifiutata', 'completata', 'scaduta'] as const
export type StatoRichiesta = (typeof STATI_RICHIESTA)[number]

export const SchemaRichiesta = z.object({
  id: Id,
  utenteId: Id,
  utenteNome: z.string(),
  codice: z.string(),
  dispositivo: z.string(),
  agente: z.string(),
  stato: z.enum(STATI_RICHIESTA),
  creatoIl: Epoch,
  scadeIl: Epoch,
})
export type Richiesta = z.infer<typeof SchemaRichiesta>

export const SchemaInvito = z.object({
  id: Id,
  utenteId: Id,
  utenteNome: z.string(),
  creatoIl: Epoch,
  scadeIl: Epoch,
  stato: z.enum(['valido', 'usato', 'scaduto', 'annullato']),
})
export type Invito = z.infer<typeof SchemaInvito>

/** Invito appena creato: l'unico momento in cui il link (con il token) è visibile. */
export const SchemaInvitoCreato = SchemaInvito.extend({ link: z.string() })
export type InvitoCreato = z.infer<typeof SchemaInvitoCreato>

// ── Attivazione del dispositivo (pubblica) ───────────────────

export const LUNGHEZZA_TOKEN = 43 // 32 byte in base64url

export const SchemaNuovaRichiesta = z.object({
  invito: z.string().trim().min(20).max(100),
  dispositivo: z.string().trim().max(80).default(''),
})
export type NuovaRichiesta = z.infer<typeof SchemaNuovaRichiesta>

export const SchemaStatoAttivazione = z.object({
  stato: z.enum(STATI_RICHIESTA),
  codice: z.string(),
  utenteNome: z.string(),
})
export type StatoAttivazione = z.infer<typeof SchemaStatoAttivazione>

// ── Amministrazione ─────────────────────────────────────────

export const SchemaNuovoUtente = z.object({
  id: Id,
  nome: NomeObbligatorio.max(60),
  ruolo: z.enum(RUOLI).default('utente'),
  /** Entra subito nel gruppo familiare (bacheca e ricettario di famiglia). */
  famiglia: z.boolean().default(true),
})
export type NuovoUtente = z.infer<typeof SchemaNuovoUtente>

export const SchemaAggiornaUtente = z.object({
  nome: NomeObbligatorio.max(60),
  ruolo: z.enum(RUOLI),
  stato: z.enum(STATI_UTENTE),
  versione: Versione,
})
export type AggiornaUtente = z.infer<typeof SchemaAggiornaUtente>

// ── Condivisioni ────────────────────────────────────────────

export const SchemaCondivisioneEvento = z.object({
  utenteId: Id,
  utenteNome: z.string(),
  permesso: z.enum(PERMESSI_EVENTO),
  /** Può scrivere in bacheca, votare, proporre e offrirsi (anche con la sola lettura). */
  partecipa: z.boolean(),
})
export type CondivisioneEvento = z.infer<typeof SchemaCondivisioneEvento>

/** Accesso dell'utente corrente a un evento; le condivisioni solo per il proprietario. */
export const SchemaAccessoEvento = z.object({
  permesso: z.enum(['proprietario', 'modifica', 'lettura']),
  /** L'utente corrente può partecipare (bacheca, sondaggi, proposte, chi porta cosa). */
  partecipa: z.boolean(),
  proprietario: SchemaPersona,
  /** Famiglia dell'evento: i suoi membri sono le persone che si possono invitare. */
  gruppo: SchemaPersona.nullable(),
  condivisioni: z.array(SchemaCondivisioneEvento),
})
export type AccessoEvento = z.infer<typeof SchemaAccessoEvento>

export const SchemaImpostaCondivisione = z.object({ permesso: z.enum(PERMESSI_EVENTO), partecipa: z.boolean().default(true) })
export const SchemaTrasferisci = z.object({ utenteId: Id, versione: Versione })
export const SchemaFamigliaEvento = z.object({ gruppoId: Id.nullable() })

export const SchemaCondivisioniPiatto = z.object({ utenti: z.array(SchemaPersona) })
export const SchemaCopiaPiatto = z.object({ id: Id })
