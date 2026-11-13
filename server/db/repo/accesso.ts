// SQL di utenti, inviti, richieste di attivazione, sessioni, condivisioni e permessi.
import { type Db, esegui, tutti, uno } from '../connessione.ts'

export interface RigaUtente {
  id: string
  nome: string
  nome_norm: string
  ruolo: 'amministratore' | 'utente'
  stato: 'attivo' | 'sospeso'
  versione: number
  creato_il: number
  aggiornato_il: number
}

export interface RigaInvito {
  id: string
  utente_id: string
  token_hash: string
  creato_da: string | null
  creato_il: number
  scade_il: number
  usato_il: number | null
  annullato_il: number | null
}

export interface RigaRichiesta {
  id: string
  invito_id: string
  utente_id: string
  segreto_hash: string
  codice: string
  dispositivo: string
  agente: string
  stato: 'in_attesa' | 'approvata' | 'rifiutata' | 'completata'
  deciso_da: string | null
  creato_il: number
  scade_il: number
  deciso_il: number | null
}

export interface RigaSessione {
  id: string
  utente_id: string
  token_hash: string
  dispositivo: string
  agente: string
  creato_il: number
  ultimo_uso: number
  scade_il: number
  revocata_il: number | null
}

// ── Utenti ───────────────────────────────────────────────────

export const leggiUtente = (db: Db, id: string) => uno<RigaUtente>(db, 'SELECT * FROM utenti WHERE id = ?', id)
export const utentePerNome = (db: Db, nomeNorm: string) => uno<RigaUtente>(db, 'SELECT * FROM utenti WHERE nome_norm = ?', nomeNorm)
export const elencaUtenti = (db: Db) => tutti<RigaUtente>(db, 'SELECT * FROM utenti ORDER BY nome_norm')
export const contaAmministratoriAttivi = (db: Db) =>
  uno<{ n: number }>(db, "SELECT count(*) AS n FROM utenti WHERE ruolo = 'amministratore' AND stato = 'attivo'")!.n

export function inserisciUtente(db: Db, u: Pick<RigaUtente, 'id' | 'nome' | 'nome_norm' | 'ruolo'>, adesso: number): void {
  esegui(
    db,
    'INSERT INTO utenti (id, nome, nome_norm, ruolo, stato, versione, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, \'attivo\', 1, ?, ?)',
    u.id,
    u.nome,
    u.nome_norm,
    u.ruolo,
    adesso,
    adesso,
  )
}

export function aggiornaUtente(db: Db, id: string, versione: number, u: Pick<RigaUtente, 'nome' | 'nome_norm' | 'ruolo' | 'stato'>, adesso: number): number {
  return esegui(
    db,
    'UPDATE utenti SET nome = ?, nome_norm = ?, ruolo = ?, stato = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ? AND versione = ?',
    u.nome,
    u.nome_norm,
    u.ruolo,
    u.stato,
    adesso,
    id,
    versione,
  )
}

// ── Inviti ───────────────────────────────────────────────────

export const invitoPerHash = (db: Db, hash: string) => uno<RigaInvito>(db, 'SELECT * FROM inviti WHERE token_hash = ?', hash)
export const leggiInvito = (db: Db, id: string) => uno<RigaInvito>(db, 'SELECT * FROM inviti WHERE id = ?', id)
export const elencaInviti = (db: Db, utenteId?: string) =>
  utenteId
    ? tutti<RigaInvito>(db, 'SELECT * FROM inviti WHERE utente_id = ? ORDER BY creato_il DESC', utenteId)
    : tutti<RigaInvito>(db, 'SELECT * FROM inviti ORDER BY creato_il DESC LIMIT 200')

export function inserisciInvito(db: Db, i: Omit<RigaInvito, 'usato_il' | 'annullato_il'>): void {
  esegui(
    db,
    'INSERT INTO inviti (id, utente_id, token_hash, creato_da, creato_il, scade_il) VALUES (?, ?, ?, ?, ?, ?)',
    i.id,
    i.utente_id,
    i.token_hash,
    i.creato_da,
    i.creato_il,
    i.scade_il,
  )
}

/** Consuma l'invito solo se ancora utilizzabile: 1 = consumato ora, 0 = già usato o non valido. */
export function consumaInvito(db: Db, id: string, adesso: number): number {
  return esegui(db, 'UPDATE inviti SET usato_il = ? WHERE id = ? AND usato_il IS NULL AND annullato_il IS NULL AND scade_il > ?', adesso, id, adesso)
}

export function annullaInvito(db: Db, id: string, adesso: number): number {
  return esegui(db, 'UPDATE inviti SET annullato_il = ? WHERE id = ? AND usato_il IS NULL AND annullato_il IS NULL', adesso, id)
}

// ── Richieste di attivazione ─────────────────────────────────

export const richiestaPerSegreto = (db: Db, hash: string) => uno<RigaRichiesta>(db, 'SELECT * FROM richieste_attivazione WHERE segreto_hash = ?', hash)
export const leggiRichiesta = (db: Db, id: string) => uno<RigaRichiesta>(db, 'SELECT * FROM richieste_attivazione WHERE id = ?', id)
export const richiesteInAttesa = (db: Db, adesso: number, utenteId?: string) =>
  utenteId
    ? tutti<RigaRichiesta>(db, "SELECT * FROM richieste_attivazione WHERE stato = 'in_attesa' AND scade_il > ? AND utente_id = ? ORDER BY creato_il", adesso, utenteId)
    : tutti<RigaRichiesta>(db, "SELECT * FROM richieste_attivazione WHERE stato = 'in_attesa' AND scade_il > ? ORDER BY creato_il", adesso)

export function inserisciRichiesta(db: Db, r: Omit<RigaRichiesta, 'stato' | 'deciso_da' | 'deciso_il'>): void {
  esegui(
    db,
    'INSERT INTO richieste_attivazione (id, invito_id, utente_id, segreto_hash, codice, dispositivo, agente, creato_il, scade_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    r.id,
    r.invito_id,
    r.utente_id,
    r.segreto_hash,
    r.codice,
    r.dispositivo,
    r.agente,
    r.creato_il,
    r.scade_il,
  )
}

/** Cambia stato solo partendo da quello atteso: protegge da decisioni o completamenti doppi. */
export function cambiaStatoRichiesta(db: Db, id: string, da: RigaRichiesta['stato'], a: RigaRichiesta['stato'], decisoDa: string | null, adesso: number): number {
  return esegui(
    db,
    'UPDATE richieste_attivazione SET stato = ?, deciso_da = coalesce(?, deciso_da), deciso_il = coalesce(deciso_il, ?) WHERE id = ? AND stato = ?',
    a,
    decisoDa,
    adesso,
    id,
    da,
  )
}

// ── Sessioni ─────────────────────────────────────────────────

export const sessionePerHash = (db: Db, hash: string) => uno<RigaSessione>(db, 'SELECT * FROM sessioni WHERE token_hash = ?', hash)
export const leggiSessione = (db: Db, id: string) => uno<RigaSessione>(db, 'SELECT * FROM sessioni WHERE id = ?', id)
export const sessioniAttive = (db: Db, adesso: number, utenteId?: string) =>
  utenteId
    ? tutti<RigaSessione>(db, 'SELECT * FROM sessioni WHERE revocata_il IS NULL AND scade_il > ? AND utente_id = ? ORDER BY ultimo_uso DESC', adesso, utenteId)
    : tutti<RigaSessione>(db, 'SELECT * FROM sessioni WHERE revocata_il IS NULL AND scade_il > ? ORDER BY ultimo_uso DESC', adesso)

export function inserisciSessione(db: Db, s: Omit<RigaSessione, 'revocata_il'>): void {
  esegui(
    db,
    'INSERT INTO sessioni (id, utente_id, token_hash, dispositivo, agente, creato_il, ultimo_uso, scade_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    s.id,
    s.utente_id,
    s.token_hash,
    s.dispositivo,
    s.agente,
    s.creato_il,
    s.ultimo_uso,
    s.scade_il,
  )
}

export function rinnovaSessione(db: Db, id: string, adesso: number, scadeIl: number): void {
  esegui(db, 'UPDATE sessioni SET ultimo_uso = ?, scade_il = ? WHERE id = ? AND revocata_il IS NULL', adesso, scadeIl, id)
}

export function revocaSessione(db: Db, id: string, adesso: number): number {
  return esegui(db, 'UPDATE sessioni SET revocata_il = ? WHERE id = ? AND revocata_il IS NULL', adesso, id)
}

export function revocaSessioniUtente(db: Db, utenteId: string, adesso: number): number {
  return esegui(db, 'UPDATE sessioni SET revocata_il = ? WHERE utente_id = ? AND revocata_il IS NULL', adesso, utenteId)
}

// ── Permessi ─────────────────────────────────────────────────

export interface AccessoRiga {
  proprietario_id: string
  permesso: 'lettura' | 'modifica' | null
}

/** Proprietario dell'evento e condivisione dell'utente (se c'è). */
export const accessoEvento = (db: Db, eventoId: string, utenteId: string) =>
  uno<AccessoRiga>(
    db,
    `SELECT e.proprietario_id, c.permesso FROM eventi e
     LEFT JOIN condivisioni_evento c ON c.evento_id = e.id AND c.utente_id = ?
     WHERE e.id = ?`,
    utenteId,
    eventoId,
  )

export const eventoDiVoce = (db: Db, id: string) => uno<{ evento_id: string }>(db, 'SELECT evento_id FROM voci_menu WHERE id = ?', id)?.evento_id
export const eventoDiAttivita = (db: Db, id: string) => uno<{ evento_id: string }>(db, 'SELECT evento_id FROM attivita WHERE id = ?', id)?.evento_id
export const eventoDiArticolo = (db: Db, id: string) => uno<{ evento_id: string }>(db, 'SELECT evento_id FROM articoli_spesa WHERE id = ?', id)?.evento_id
export const eventoDiSnapshot = (db: Db, id: string) => uno<{ evento_id: string }>(db, 'SELECT evento_id FROM snapshot_eventi WHERE id = ?', id)?.evento_id
export const piattoDiFoto = (db: Db, id: string) => uno<{ piatto_id: string }>(db, 'SELECT piatto_id FROM foto_piatti WHERE id = ?', id)?.piatto_id
export const proprietarioPiatto = (db: Db, id: string) => uno<{ proprietario_id: string }>(db, 'SELECT proprietario_id FROM piatti WHERE id = ?', id)?.proprietario_id
export const proprietarioEvento = (db: Db, id: string) => uno<{ proprietario_id: string }>(db, 'SELECT proprietario_id FROM eventi WHERE id = ?', id)?.proprietario_id

/**
 * Lettura di un piatto non proprio: del ricettario di famiglia (non privato), condiviso con
 * l'utente, oppure collegato a una voce di un evento che l'utente può leggere (la ricetta
 * serve per cucinare quel menù).
 */
export function piattoLeggibileDaAltri(db: Db, piattoId: string, utenteId: string): boolean {
  return (
    uno(
      db,
      `SELECT 1 FROM piatti WHERE id = ? AND visibilita = 'famiglia'
       UNION ALL
       SELECT 1 FROM condivisioni_piatto WHERE piatto_id = ? AND utente_id = ?
       UNION ALL
       SELECT 1 FROM voci_menu v JOIN eventi e ON e.id = v.evento_id
       WHERE v.piatto_id = ? AND (e.proprietario_id = ? OR EXISTS (SELECT 1 FROM condivisioni_evento c WHERE c.evento_id = e.id AND c.utente_id = ?))
       LIMIT 1`,
      piattoId,
      piattoId,
      utenteId,
      piattoId,
      utenteId,
      utenteId,
    ) !== undefined
  )
}

/** Condizione SQL «evento visibile all'utente» su un alias `e` (parametro: id utente due volte). */
export const EVENTO_VISIBILE = '(e.proprietario_id = ? OR EXISTS (SELECT 1 FROM condivisioni_evento c WHERE c.evento_id = e.id AND c.utente_id = ?))'

// ── Condivisioni ─────────────────────────────────────────────

export const condivisioniEvento = (db: Db, eventoId: string) =>
  tutti<{ utente_id: string; nome: string; permesso: 'lettura' | 'modifica' }>(
    db,
    'SELECT c.utente_id, u.nome, c.permesso FROM condivisioni_evento c JOIN utenti u ON u.id = c.utente_id WHERE c.evento_id = ? ORDER BY u.nome_norm',
    eventoId,
  )

export function impostaCondivisioneEvento(db: Db, eventoId: string, utenteId: string, permesso: string, adesso: number): void {
  esegui(
    db,
    'INSERT INTO condivisioni_evento (evento_id, utente_id, permesso, creato_il) VALUES (?, ?, ?, ?) ON CONFLICT (evento_id, utente_id) DO UPDATE SET permesso = excluded.permesso',
    eventoId,
    utenteId,
    permesso,
    adesso,
  )
}

export const togliCondivisioneEvento = (db: Db, eventoId: string, utenteId: string) =>
  esegui(db, 'DELETE FROM condivisioni_evento WHERE evento_id = ? AND utente_id = ?', eventoId, utenteId)

export const condivisioniPiatto = (db: Db, piattoId: string) =>
  tutti<{ utente_id: string; nome: string }>(
    db,
    'SELECT c.utente_id, u.nome FROM condivisioni_piatto c JOIN utenti u ON u.id = c.utente_id WHERE c.piatto_id = ? ORDER BY u.nome_norm',
    piattoId,
  )

export function impostaVisibilitaPiatto(db: Db, piattoId: string, visibilita: 'famiglia' | 'privata', adesso: number): void {
  esegui(db, 'UPDATE piatti SET visibilita = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', visibilita, adesso, piattoId)
}

export function sostituisciCondivisioniPiatto(db: Db, piattoId: string, utenti: string[], adesso: number): void {
  esegui(db, 'DELETE FROM condivisioni_piatto WHERE piatto_id = ?', piattoId)
  for (const u of utenti) esegui(db, 'INSERT INTO condivisioni_piatto (piatto_id, utente_id, creato_il) VALUES (?, ?, ?)', piattoId, u, adesso)
}
