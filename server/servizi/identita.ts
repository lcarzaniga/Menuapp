// Utenti, inviti, attivazione dei dispositivi e sessioni (SPEC §19.1–15.2).
// Token casuali da 256 bit; sul server resta solo l'impronta SHA-256.
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'
import type {
  AggiornaUtente,
  Invito,
  InvitoCreato,
  NuovoUtente,
  Persona,
  Richiesta,
  Sessione,
  StatoAttivazione,
  StatoRichiesta,
  Utente,
} from '../../src/contratto/accesso.ts'
import { norm } from '../../src/domain/testo.ts'
import { type Db, transazione } from '../db/connessione.ts'
import * as repo from '../db/repo/accesso.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { accessoNegato, conflittoVersione, ErroreApi, nonTrovato, regolaViolata } from './errori.ts'
import type { UtenteCorrente } from './permessi.ts'

export const DURATA_INVITO = 24 * 3600_000
export const DURATA_RICHIESTA = 24 * 3600_000
export const DURATA_SESSIONE = 180 * 24 * 3600_000
/** Rinnovo della sessione (scadenza scorrevole) al più una volta l'ora. */
const RINNOVO_SESSIONE = 3600_000

export const nuovoToken = () => randomBytes(32).toString('base64url')
export const impronta = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')

/** Codice breve da confrontare a voce (es. al telefono): niente caratteri ambigui. */
const ALFABETO_CODICE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function codiceVerifica(): string {
  const c = Array.from({ length: 6 }, () => ALFABETO_CODICE[randomInt(ALFABETO_CODICE.length)]).join('')
  return `${c.slice(0, 3)}-${c.slice(3)}`
}

/** Testo libero dal browser (nome del dispositivo, user agent): niente caratteri di controllo. */
const testoBreve = (s: string, max: number) =>
  [...s]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c))
    .join('')
    .trim()
    .slice(0, max)

// ── Utenti ───────────────────────────────────────────────────

const daRigaUtente = (r: repo.RigaUtente): Utente => ({
  id: r.id,
  nome: r.nome,
  ruolo: r.ruolo,
  stato: r.stato,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
})

export function leggiUtente(db: Db, id: string): Utente {
  const r = repo.leggiUtente(db, id)
  if (!r) throw nonTrovato('Utente')
  return daRigaUtente(r)
}

export const elencaUtenti = (db: Db): Utente[] => repo.elencaUtenti(db).map(daRigaUtente)

export const famigliaDi = (db: Db, utenteId: string) => repo.famigliaDi(db, utenteId)

/** Persone della stessa Famiglia con cui condividere (escluso chi chiede). */
export const elencaPersone = (db: Db, utenteId: string, gruppoId?: string): Persona[] =>
  gruppoId ? repo.membriGruppo(db, gruppoId).filter((m) => m.utente_id !== utenteId).map((m) => ({ id: m.utente_id, nome: m.nome })) : repo.personeDellaFamiglia(db, utenteId)

/** Nuovo utente; con `famiglia` entra nella Famiglia indicata (quella di chi lo crea). */
export function creaUtente(db: Db, d: NuovoUtente, adesso = Date.now(), famigliaId?: string): Utente {
  return transazione(db, () => {
    const nome = d.nome.trim()
    if (repo.leggiUtente(db, d.id)) throw new ErroreApi(409, 'id_esistente', 'Esiste già un utente con questo identificativo')
    if (repo.utentePerNome(db, norm(nome))) throw regolaViolata('nome_utente_duplicato', 'Esiste già un utente con questo nome')
    repo.inserisciUtente(db, { id: d.id, nome, nome_norm: norm(nome), ruolo: d.ruolo }, adesso)
    const famiglia = famigliaId ?? repo.elencaGruppi(db)[0]?.id
    if (d.famiglia !== false && famiglia) repo.aggiungiMembro(db, famiglia, d.id, d.ruolo === 'amministratore' ? 'amministratore' : 'membro', adesso)
    incrementaRevisione(db)
    return leggiUtente(db, d.id)
  })
}

export function aggiornaUtente(db: Db, chi: UtenteCorrente, id: string, d: AggiornaUtente, adesso = Date.now()): Utente {
  return transazione(db, () => {
    const prima = repo.leggiUtente(db, id)
    if (!prima) throw nonTrovato('Utente')
    if (prima.versione !== d.versione) throw conflittoVersione(daRigaUtente(prima))
    const nome = d.nome.trim()
    const omonimo = repo.utentePerNome(db, norm(nome))
    if (omonimo && omonimo.id !== id) throw regolaViolata('nome_utente_duplicato', 'Esiste già un utente con questo nome')
    const perdeAdmin = prima.ruolo === 'amministratore' && prima.stato === 'attivo' && (d.ruolo !== 'amministratore' || d.stato !== 'attivo')
    if (perdeAdmin && repo.contaAmministratoriAttivi(db) <= 1) {
      throw regolaViolata('ultimo_amministratore', 'Serve almeno un amministratore attivo')
    }
    if (id === chi.id && d.stato !== 'attivo') throw regolaViolata('sospendi_te_stesso', 'Non puoi sospendere il tuo account')
    repo.aggiornaUtente(db, id, d.versione, { nome, nome_norm: norm(nome), ruolo: d.ruolo, stato: d.stato }, adesso)
    // Un utente sospeso perde subito tutti i dispositivi, inviti e richieste in corso.
    if (d.stato === 'sospeso') {
      repo.revocaSessioniUtente(db, id, adesso)
      for (const i of repo.elencaInviti(db, id)) repo.annullaInvito(db, i.id, adesso)
      for (const r of repo.richiesteInAttesa(db, adesso, id)) repo.cambiaStatoRichiesta(db, r.id, 'in_attesa', 'rifiutata', chi.id, adesso)
    }
    incrementaRevisione(db)
    return leggiUtente(db, id)
  })
}

// ── Inviti ───────────────────────────────────────────────────

function statoInvito(r: repo.RigaInvito, adesso: number): Invito['stato'] {
  if (r.annullato_il !== null) return 'annullato'
  if (r.usato_il !== null) return 'usato'
  return r.scade_il <= adesso ? 'scaduto' : 'valido'
}

function daRigaInvito(db: Db, r: repo.RigaInvito, adesso: number): Invito {
  return { id: r.id, utenteId: r.utente_id, utenteNome: repo.leggiUtente(db, r.utente_id)?.nome ?? '', creatoIl: r.creato_il, scadeIl: r.scade_il, stato: statoInvito(r, adesso) }
}

/**
 * Nuovo invito monouso per un dispositivo di `utenteId`. Lo crea l'amministratore per
 * chiunque, oppure l'utente stesso per un suo nuovo dispositivo.
 */
export function creaInvito(db: Db, chi: UtenteCorrente | null, utenteId: string, urlBase: string, adesso = Date.now()): InvitoCreato {
  if (chi && chi.ruolo !== 'amministratore' && chi.id !== utenteId) throw accessoNegato('Puoi creare inviti solo per i tuoi dispositivi')
  return transazione(db, () => {
    const u = repo.leggiUtente(db, utenteId)
    if (!u) throw nonTrovato('Utente')
    if (u.stato !== 'attivo') throw regolaViolata('utente_sospeso', 'L\'utente è sospeso')
    const token = nuovoToken()
    const id = randomUUID()
    repo.inserisciInvito(db, { id, utente_id: utenteId, token_hash: impronta(token), creato_da: chi?.id ?? null, creato_il: adesso, scade_il: adesso + DURATA_INVITO })
    const invito = daRigaInvito(db, repo.leggiInvito(db, id)!, adesso)
    return { ...invito, link: `${urlBase.replace(/\/+$/, '')}/#/attiva/${token}` }
  })
}

export const elencaInviti = (db: Db, utenteId?: string, adesso = Date.now()): Invito[] =>
  repo.elencaInviti(db, utenteId).map((r) => daRigaInvito(db, r, adesso))

export function annullaInvito(db: Db, chi: UtenteCorrente, id: string, adesso = Date.now()): void {
  const r = repo.leggiInvito(db, id)
  if (!r || (chi.ruolo !== 'amministratore' && r.utente_id !== chi.id)) throw nonTrovato('Invito')
  repo.annullaInvito(db, id, adesso)
}

// ── Attivazione del dispositivo ──────────────────────────────

export class InvitoNonValido extends ErroreApi {
  constructor(messaggio: string) {
    super(404, 'non_trovato', messaggio)
  }
}

/**
 * Dal link d'invito nasce una richiesta legata al browser che la invia (segreto nel cookie).
 * L'invito si consuma qui: un secondo uso dello stesso link non crea altre richieste.
 */
export function richiediAttivazione(db: Db, d: { invito: string; dispositivo: string; agente: string }, adesso = Date.now()): { segreto: string; stato: StatoAttivazione } {
  return transazione(db, () => {
    const invito = repo.invitoPerHash(db, impronta(d.invito))
    if (!invito) throw new InvitoNonValido('Invito non valido: controlla di aver aperto il link completo')
    if (invito.annullato_il !== null) throw new InvitoNonValido('Questo invito è stato annullato: chiedine uno nuovo')
    if (invito.usato_il !== null) throw new InvitoNonValido('Questo invito è già stato usato: chiedine uno nuovo')
    if (invito.scade_il <= adesso) throw new InvitoNonValido('Questo invito è scaduto: chiedine uno nuovo')
    const utente = repo.leggiUtente(db, invito.utente_id)
    if (!utente || utente.stato !== 'attivo') throw new InvitoNonValido('Questo invito non è più valido')
    if (repo.consumaInvito(db, invito.id, adesso) !== 1) throw new InvitoNonValido('Questo invito è già stato usato: chiedine uno nuovo')
    const segreto = nuovoToken()
    const codice = codiceVerifica()
    repo.inserisciRichiesta(db, {
      id: randomUUID(),
      invito_id: invito.id,
      utente_id: utente.id,
      segreto_hash: impronta(segreto),
      codice,
      dispositivo: testoBreve(d.dispositivo, 80),
      agente: testoBreve(d.agente, 300),
      creato_il: adesso,
      scade_il: adesso + DURATA_RICHIESTA,
    })
    incrementaRevisione(db)
    return { segreto, stato: { stato: 'in_attesa', codice, utenteNome: utente.nome } }
  })
}

const statoEffettivo = (r: repo.RigaRichiesta, adesso: number): StatoRichiesta =>
  (r.stato === 'in_attesa' || r.stato === 'approvata') && r.scade_il <= adesso ? 'scaduta' : r.stato

/** Stato della richiesta di questo browser (dal segreto nel cookie). */
export function statoAttivazione(db: Db, segreto: string, adesso = Date.now()): StatoAttivazione | null {
  const r = repo.richiestaPerSegreto(db, impronta(segreto))
  if (!r) return null
  return { stato: statoEffettivo(r, adesso), codice: r.codice, utenteNome: repo.leggiUtente(db, r.utente_id)?.nome ?? '' }
}

/**
 * Il browser che possiede il segreto di una richiesta approvata riceve la sessione. Il
 * passaggio approvata → completata avviene una sola volta.
 */
export function completaAttivazione(db: Db, segreto: string, adesso = Date.now()): { token: string; sessioneId: string } | null {
  return transazione(db, () => {
    const r = repo.richiestaPerSegreto(db, impronta(segreto))
    if (!r || statoEffettivo(r, adesso) !== 'approvata') return null
    const utente = repo.leggiUtente(db, r.utente_id)
    if (!utente || utente.stato !== 'attivo') return null
    if (repo.cambiaStatoRichiesta(db, r.id, 'approvata', 'completata', null, adesso) !== 1) return null
    const token = nuovoToken()
    const sessioneId = randomUUID()
    repo.inserisciSessione(db, {
      id: sessioneId,
      utente_id: r.utente_id,
      token_hash: impronta(token),
      dispositivo: r.dispositivo,
      agente: r.agente,
      creato_il: adesso,
      ultimo_uso: adesso,
      scade_il: adesso + DURATA_SESSIONE,
    })
    incrementaRevisione(db)
    return { token, sessioneId }
  })
}

const daRigaRichiesta = (db: Db, r: repo.RigaRichiesta, adesso: number): Richiesta => ({
  id: r.id,
  utenteId: r.utente_id,
  utenteNome: repo.leggiUtente(db, r.utente_id)?.nome ?? '',
  codice: r.codice,
  dispositivo: r.dispositivo,
  agente: r.agente,
  stato: statoEffettivo(r, adesso),
  creatoIl: r.creato_il,
  scadeIl: r.scade_il,
})

/** Richieste in attesa: tutte per l'amministratore, solo le proprie per gli altri. */
export function richiesteInAttesa(db: Db, chi: UtenteCorrente | null, adesso = Date.now()): Richiesta[] {
  const soloSue = chi && chi.ruolo !== 'amministratore' ? chi.id : undefined
  return repo.richiesteInAttesa(db, adesso, soloSue).map((r) => daRigaRichiesta(db, r, adesso))
}

/**
 * Approva o rifiuta una specifica richiesta. Decide l'amministratore (o la console del
 * server, `chi` = null) oppure l'utente stesso da un dispositivo già autorizzato.
 */
export function decidiRichiesta(db: Db, chi: UtenteCorrente | null, id: string, decisione: 'approva' | 'rifiuta', adesso = Date.now()): Richiesta {
  return transazione(db, () => {
    const r = repo.leggiRichiesta(db, id)
    if (!r || (chi && chi.ruolo !== 'amministratore' && r.utente_id !== chi.id)) throw nonTrovato('Richiesta')
    if (statoEffettivo(r, adesso) !== 'in_attesa') throw regolaViolata('richiesta_non_in_attesa', 'La richiesta non è più in attesa')
    repo.cambiaStatoRichiesta(db, id, 'in_attesa', decisione === 'approva' ? 'approvata' : 'rifiutata', chi?.id ?? null, adesso)
    incrementaRevisione(db)
    return daRigaRichiesta(db, repo.leggiRichiesta(db, id)!, adesso)
  })
}

// ── Sessioni ─────────────────────────────────────────────────

export interface SessioneValida {
  utente: Utente
  sessioneId: string
  /** true se la scadenza è stata rinnovata (il cookie va reinviato). */
  rinnovata: boolean
}

/** Sessione dal token del cookie: valida solo se non revocata, non scaduta e utente attivo. */
export function sessioneDaToken(db: Db, token: string, adesso = Date.now()): SessioneValida | null {
  const s = repo.sessionePerHash(db, impronta(token))
  if (!s || s.revocata_il !== null || s.scade_il <= adesso) return null
  const u = repo.leggiUtente(db, s.utente_id)
  if (!u || u.stato !== 'attivo') return null
  const rinnovata = adesso - s.ultimo_uso > RINNOVO_SESSIONE
  if (rinnovata) repo.rinnovaSessione(db, s.id, adesso, adesso + DURATA_SESSIONE)
  return { utente: daRigaUtente(u), sessioneId: s.id, rinnovata }
}

const daRigaSessione = (db: Db, s: repo.RigaSessione, corrente: string): Sessione => ({
  id: s.id,
  utenteId: s.utente_id,
  utenteNome: repo.leggiUtente(db, s.utente_id)?.nome ?? '',
  dispositivo: s.dispositivo,
  agente: s.agente,
  creatoIl: s.creato_il,
  ultimoUso: s.ultimo_uso,
  scadeIl: s.scade_il,
  corrente: s.id === corrente,
})

/** Dispositivi autorizzati: i propri, oppure tutti per l'amministratore. */
export function elencaSessioni(db: Db, chi: UtenteCorrente, tutte: boolean, adesso = Date.now()): Sessione[] {
  if (tutte && chi.ruolo !== 'amministratore') throw accessoNegato('Funzione riservata all\'amministratore')
  return repo.sessioniAttive(db, adesso, tutte ? undefined : chi.id).map((s) => daRigaSessione(db, s, chi.sessioneId))
}

export function revocaSessione(db: Db, chi: UtenteCorrente | null, id: string, adesso = Date.now()): void {
  const s = repo.leggiSessione(db, id)
  if (!s || (chi && chi.ruolo !== 'amministratore' && s.utente_id !== chi.id)) throw nonTrovato('Sessione')
  repo.revocaSessione(db, id, adesso)
  incrementaRevisione(db)
}
