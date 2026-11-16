// Famiglie (SPEC §21): ogni persona ha un account e può far parte di più Famiglie, ciascuna
// isolata dalle altre. Ruoli semplici: amministratore (membri e impostazioni della Famiglia) e
// membro. L'amministratore non vede per questo i contenuti privati degli altri.
import { randomUUID } from 'node:crypto'
import type { AnteprimaInvito, Gruppo, InvitoFamiglia, InvitoFamigliaCreato } from '../../src/contratto/famiglia.ts'
import { pulisci } from '../../src/domain/testo.ts'
import { type Db, transazione } from '../db/connessione.ts'
import * as repo from '../db/repo/accesso.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import { impronta, nuovoToken } from './identita.ts'
import { richiediGruppo, type UtenteCorrente } from './permessi.ts'

export const DURATA_INVITO_FAMIGLIA = 7 * 24 * 3600_000

const conMembri = (db: Db, g: { id: string; nome: string }, ruolo: Gruppo['ruolo']): Gruppo => ({
  id: g.id,
  nome: g.nome,
  versione: repo.leggiGruppo(db, g.id)?.versione ?? 1,
  ruolo,
  membri: repo.membriGruppo(db, g.id).map((m) => ({ id: m.utente_id, nome: m.nome, ruolo: m.ruolo })),
})

/** Famiglie di un utente (senza membri). */
export const gruppiDiUtente = (db: Db, utenteId: string) => repo.gruppiDiUtente(db, utenteId)

/** Famiglie di cui l'utente fa parte, con i membri. */
export const gruppiDi = (db: Db, u: UtenteCorrente): Gruppo[] => repo.gruppiDiUtente(db, u.id).map((g) => conMembri(db, g, g.ruolo))

function famiglia(db: Db, u: UtenteCorrente, id: string): Gruppo {
  const g = gruppiDi(db, u).find((x) => x.id === id)
  if (!g) throw nonTrovato('Famiglia')
  return g
}

/** Tutti i gruppi con i membri e il loro ruolo (amministrazione dell'app). */
export const tuttiIGruppi = (db: Db) =>
  repo.elencaGruppi(db).map((g) => ({ id: g.id, nome: g.nome, membri: repo.membriGruppo(db, g.id).map((m) => ({ id: m.utente_id, nome: m.nome, ruolo: m.ruolo })) }))

/** Nuova Famiglia: chi la crea ne è l'amministratore. */
export function creaFamiglia(db: Db, u: UtenteCorrente, d: { id: string; nome: string }, adesso = Date.now()): Gruppo {
  return transazione(db, () => {
    if (repo.leggiGruppo(db, d.id)) {
      if (repo.ruoloNelGruppo(db, d.id, u.id)) return famiglia(db, u, d.id) // ripetizione
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    repo.inserisciGruppo(db, d.id, pulisci(d.nome), adesso)
    repo.aggiungiMembro(db, d.id, u.id, 'amministratore', adesso)
    incrementaRevisione(db)
    return famiglia(db, u, d.id)
  })
}

export function rinomina(db: Db, u: UtenteCorrente, id: string, nome: string, versione: number, adesso = Date.now()): Gruppo {
  return transazione(db, () => {
    richiediGruppo(db, u, id, 'amministratore')
    if (repo.rinominaGruppo(db, id, pulisci(nome), versione, adesso) !== 1) throw conflittoVersione(famiglia(db, u, id))
    incrementaRevisione(db)
    return famiglia(db, u, id)
  })
}

// ── Inviti ad aderire ───────────────────────────────────────

const statoInvito = (r: repo.RigaInvitoFamiglia, adesso: number): InvitoFamiglia['stato'] =>
  r.annullato_il !== null ? 'annullato' : r.usato_il !== null ? 'usato' : r.scade_il <= adesso ? 'scaduto' : 'valido'

/**
 * Link per entrare nella Famiglia, per chi ha già un account (l'account si crea con l'invito
 * del dispositivo, §19.2). Lo crea un amministratore della Famiglia; vale una volta, 7 giorni.
 */
export function creaInvito(db: Db, u: UtenteCorrente, gruppoId: string, urlBase: string, adesso = Date.now()): InvitoFamigliaCreato {
  return transazione(db, () => {
    richiediGruppo(db, u, gruppoId, 'amministratore')
    const token = nuovoToken()
    const id = randomUUID()
    repo.inserisciInvitoFamiglia(db, { id, gruppo_id: gruppoId, token_hash: impronta(token), creato_da: u.id, creato_il: adesso, scade_il: adesso + DURATA_INVITO_FAMIGLIA })
    return {
      id,
      creatoIl: adesso,
      scadeIl: adesso + DURATA_INVITO_FAMIGLIA,
      stato: 'valido',
      usatoDa: null,
      famiglia: repo.leggiGruppo(db, gruppoId)!.nome,
      link: `${urlBase.replace(/\/+$/, '')}/#/unisciti/${token}`,
    }
  })
}

export function invitiDi(db: Db, u: UtenteCorrente, gruppoId: string, adesso = Date.now()): InvitoFamiglia[] {
  richiediGruppo(db, u, gruppoId, 'amministratore')
  return repo.invitiFamiglia(db, gruppoId).map((r) => ({
    id: r.id,
    creatoIl: r.creato_il,
    scadeIl: r.scade_il,
    stato: statoInvito(r, adesso),
    usatoDa: r.usato_da ? (repo.leggiUtente(db, r.usato_da)?.nome ?? null) : null,
  }))
}

export function annullaInvito(db: Db, u: UtenteCorrente, gruppoId: string, id: string, adesso = Date.now()): void {
  richiediGruppo(db, u, gruppoId, 'amministratore')
  repo.annullaInvitoFamiglia(db, id, gruppoId, adesso)
}

function invitoDaToken(db: Db, token: string) {
  const r = repo.invitoFamigliaPerHash(db, impronta(token))
  if (!r) throw nonTrovato('Invito')
  return r
}

/** Anteprima per chi apre il link (con un account): quale Famiglia, chi invita, se è ancora valido. */
export function anteprimaInvito(db: Db, u: UtenteCorrente, token: string, adesso = Date.now()): AnteprimaInvito {
  const r = invitoDaToken(db, token)
  const g = repo.leggiGruppo(db, r.gruppo_id)
  if (!g) throw nonTrovato('Invito')
  const stato = repo.ruoloNelGruppo(db, r.gruppo_id, u.id) ? 'gia_membro' : statoInvito(r, adesso)
  return { famiglia: { id: g.id, nome: g.nome }, invitatoDa: r.creato_da ? (repo.leggiUtente(db, r.creato_da)?.nome ?? null) : null, stato }
}

/** Accettazione: si entra come membro; il link non vale più per nessun altro. */
export function accettaInvito(db: Db, u: UtenteCorrente, token: string, adesso = Date.now()): Gruppo {
  return transazione(db, () => {
    const r = invitoDaToken(db, token)
    if (repo.ruoloNelGruppo(db, r.gruppo_id, u.id)) return famiglia(db, u, r.gruppo_id)
    const stato = statoInvito(r, adesso)
    if (stato !== 'valido') throw regolaViolata(`invito_${stato}`, stato === 'scaduto' ? 'L\'invito è scaduto: chiedine uno nuovo' : stato === 'usato' ? 'L\'invito è già stato usato' : 'L\'invito è stato annullato')
    if (repo.consumaInvitoFamiglia(db, r.id, u.id, adesso) !== 1) throw regolaViolata('invito_usato', 'L\'invito è già stato usato')
    repo.aggiungiMembro(db, r.gruppo_id, u.id, 'membro', adesso)
    incrementaRevisione(db)
    return famiglia(db, u, r.gruppo_id)
  })
}

// ── Membri ──────────────────────────────────────────────────

/** Deve restare almeno un amministratore finché nella Famiglia c'è qualcuno. */
function controllaAmministratori(db: Db, gruppoId: string): void {
  const membri = repo.membriGruppo(db, gruppoId)
  if (membri.length > 0 && !membri.some((m) => m.ruolo === 'amministratore')) {
    throw regolaViolata('ultimo_amministratore', 'Prima di andartene passa l\'amministrazione a un altro membro')
  }
}

/** Uscita volontaria. Chi resta da solo non esce: la Famiglia sparirebbe con i suoi contenuti. */
export function esci(db: Db, u: UtenteCorrente, gruppoId: string): void {
  transazione(db, () => {
    richiediGruppo(db, u, gruppoId)
    if (repo.membriGruppo(db, gruppoId).length === 1) throw regolaViolata('unico_membro', 'Sei l\'unico membro di questa Famiglia')
    repo.togliMembro(db, gruppoId, u.id)
    controllaAmministratori(db, gruppoId)
    incrementaRevisione(db)
  })
}

/** Un amministratore della Famiglia toglie un membro (per sé stesso c'è «Esci»). */
export function rimuovi(db: Db, u: UtenteCorrente, gruppoId: string, utenteId: string): Gruppo {
  return transazione(db, () => {
    richiediGruppo(db, u, gruppoId, 'amministratore')
    if (utenteId === u.id) throw regolaViolata('rimuovi_te_stesso', 'Per lasciare la Famiglia usa «Esci»')
    if (!repo.ruoloNelGruppo(db, gruppoId, utenteId)) throw nonTrovato('Membro')
    repo.togliMembro(db, gruppoId, utenteId)
    incrementaRevisione(db)
    return famiglia(db, u, gruppoId)
  })
}

/** Ruolo di un membro (nominare o togliere un amministratore): ne resta sempre almeno uno. */
export function impostaRuolo(db: Db, u: UtenteCorrente, gruppoId: string, utenteId: string, ruolo: 'amministratore' | 'membro', adesso = Date.now()): Gruppo {
  return transazione(db, () => {
    richiediGruppo(db, u, gruppoId, 'amministratore')
    if (!repo.ruoloNelGruppo(db, gruppoId, utenteId)) throw nonTrovato('Membro')
    repo.aggiungiMembro(db, gruppoId, utenteId, ruolo, adesso)
    controllaAmministratori(db, gruppoId)
    incrementaRevisione(db)
    return famiglia(db, u, gruppoId)
  })
}

/** Passaggio dell'amministrazione in un colpo solo: l'altro diventa amministratore, io membro. */
export function passaAmministrazione(db: Db, u: UtenteCorrente, gruppoId: string, utenteId: string, adesso = Date.now()): Gruppo {
  return transazione(db, () => {
    richiediGruppo(db, u, gruppoId, 'amministratore')
    if (utenteId === u.id) throw regolaViolata('gia_amministratore', 'Sei già amministratore')
    if (!repo.ruoloNelGruppo(db, gruppoId, utenteId)) throw nonTrovato('Membro')
    repo.aggiungiMembro(db, gruppoId, utenteId, 'amministratore', adesso)
    repo.aggiungiMembro(db, gruppoId, u.id, 'membro', adesso)
    incrementaRevisione(db)
    return famiglia(db, u, gruppoId)
  })
}

// ── Amministrazione dell'app (ingresso privato) ─────────────

export function impostaMembro(db: Db, gruppoId: string, utenteId: string, ruolo: 'amministratore' | 'membro', adesso = Date.now()) {
  return transazione(db, () => {
    if (!repo.leggiGruppo(db, gruppoId)) throw nonTrovato('Gruppo')
    if (!repo.leggiUtente(db, utenteId)) throw nonTrovato('Utente')
    repo.aggiungiMembro(db, gruppoId, utenteId, ruolo, adesso)
    incrementaRevisione(db)
    return tuttiIGruppi(db).find((g) => g.id === gruppoId)!
  })
}

export function togliMembro(db: Db, gruppoId: string, utenteId: string): void {
  transazione(db, () => {
    repo.togliMembro(db, gruppoId, utenteId)
    controllaAmministratori(db, gruppoId)
    incrementaRevisione(db)
  })
}

