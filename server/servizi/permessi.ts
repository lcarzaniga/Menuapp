// Autorizzazione: chi può fare cosa su eventi, piatti e risorse figlie (SPEC §19.3).
// Una risorsa che l'utente non può vedere risponde come inesistente (404); una visibile
// ma non modificabile risponde 403 con il motivo.
import type { Ingresso, PermessoEvento, Ruolo } from '../../src/contratto/accesso.ts'
import type { Db } from '../db/connessione.ts'
import * as repo from '../db/repo/accesso.ts'
import * as repoMemoria from '../db/repo/memoria.ts'
import { accessoNegato, nonTrovato } from './errori.ts'

export interface UtenteCorrente {
  id: string
  nome: string
  ruolo: Ruolo
  sessioneId: string
  ingresso: Ingresso
}

/** `partecipa`: scrivere in bacheca, votare, proporre, offrirsi; non modifica il menù. */
export type LivelloEvento = 'lettura' | 'partecipa' | 'modifica' | 'proprietario'

export function permessoEvento(db: Db, u: UtenteCorrente, eventoId: string): PermessoEvento | null {
  const a = repo.accessoEvento(db, eventoId, u.id)
  if (!a) return null
  if (a.proprietario_id === u.id) return 'proprietario'
  return a.permesso
}

const SUFFICIENTE: Record<Exclude<LivelloEvento, 'partecipa'>, PermessoEvento[]> = {
  lettura: ['lettura', 'modifica', 'proprietario'],
  modifica: ['modifica', 'proprietario'],
  proprietario: ['proprietario'],
}

/** Può partecipare (bacheca, sondaggi, proposte, incarichi): chi modifica, o chi legge se il proprietario non l'ha escluso. */
export function puoPartecipare(db: Db, u: UtenteCorrente, eventoId: string): boolean {
  const a = repo.accessoEvento(db, eventoId, u.id)
  if (!a) return false
  return a.proprietario_id === u.id || a.permesso === 'modifica' || (a.permesso === 'lettura' && a.partecipa === 1)
}

/** Verifica l'accesso all'evento; `cosa` è il nome della risorsa da citare nel 404. */
export function richiediEvento(db: Db, u: UtenteCorrente, eventoId: string, livello: LivelloEvento, cosa = 'Evento'): PermessoEvento {
  const p = permessoEvento(db, u, eventoId)
  if (!p) throw nonTrovato(cosa)
  if (livello === 'partecipa') {
    if (!puoPartecipare(db, u, eventoId)) throw accessoNegato('Il proprietario non ti ha abilitato a partecipare alla bacheca di questo evento')
    return p
  }
  if (!SUFFICIENTE[livello].includes(p)) {
    throw accessoNegato(livello === 'proprietario' ? 'Solo il proprietario dell\'evento può farlo' : 'Questo evento è condiviso con te in sola lettura')
  }
  return p
}

function figlio(eventoId: string | undefined, cosa: string): string {
  if (!eventoId) throw nonTrovato(cosa)
  return eventoId
}

/** Voce, attività, articolo di spesa, snapshot: risalgono all'evento. Restituiscono l'id dell'evento. */
export function richiediVoce(db: Db, u: UtenteCorrente, id: string, livello: LivelloEvento): string {
  const e = figlio(repo.eventoDiVoce(db, id), 'Voce')
  richiediEvento(db, u, e, livello, 'Voce')
  return e
}
export function richiediAttivita(db: Db, u: UtenteCorrente, id: string, livello: LivelloEvento): string {
  const e = figlio(repo.eventoDiAttivita(db, id), 'Attività')
  richiediEvento(db, u, e, livello, 'Attività')
  return e
}
export function richiediArticolo(db: Db, u: UtenteCorrente, id: string, livello: LivelloEvento): string {
  const e = figlio(repo.eventoDiArticolo(db, id), 'Articolo')
  richiediEvento(db, u, e, livello, 'Articolo')
  return e
}
export function richiediSnapshot(db: Db, u: UtenteCorrente, id: string): string {
  const e = figlio(repo.eventoDiSnapshot(db, id), 'Snapshot')
  richiediEvento(db, u, e, 'lettura', 'Snapshot')
  return e
}

export type LivelloPiatto = 'lettura' | 'proprietario'

/** Piatti: modifica solo il proprietario; lettura se condiviso o collegato a un evento visibile. */
export function richiediPiatto(db: Db, u: UtenteCorrente, id: string, livello: LivelloPiatto, cosa = 'Piatto'): void {
  const proprietario = repo.proprietarioPiatto(db, id)
  if (!proprietario) throw nonTrovato(cosa)
  if (proprietario === u.id) return
  if (!repo.piattoLeggibileDaAltri(db, id, u.id)) throw nonTrovato(cosa)
  if (livello === 'proprietario') throw accessoNegato('La ricetta è di un altro utente: puoi copiarla nel tuo ricettario')
}

export function richiediFoto(db: Db, u: UtenteCorrente, id: string, livello: LivelloPiatto): string {
  const piatto = repo.piattoDiFoto(db, id)
  if (!piatto) throw nonTrovato('Foto')
  // Foto di un ricordo o della storia: le regole della memoria di famiglia (SPEC §40).
  const memoria = repo.memoriaDiFoto(db, id)
  if (memoria) {
    richiediMemoria(db, u, memoria, livello === 'proprietario' ? 'modifica' : 'lettura', 'Foto')
    return piatto
  }
  richiediPiatto(db, u, piatto, livello, 'Foto')
  return piatto
}

/** Aggiungere ricordi ed esperienze: il proprietario e i membri della Famiglia della ricetta (SPEC §40). */
export function richiediContributoMemoria(db: Db, u: UtenteCorrente, piattoId: string): void {
  richiediPiatto(db, u, piattoId, 'lettura')
  if (!repoMemoria.memoriaScrivibile(db, piattoId, u.id)) throw accessoNegato('Aggiungono ricordi solo i membri della Famiglia della ricetta')
}

/**
 * Memoria di famiglia (SPEC §40). Lettura: chi ne fa parte (`memoriaLeggibile`); la storia anche chi
 * legge la ricetta pubblica, se pubblicata. Modifica: l'autore (la storia: il proprietario della
 * ricetta). Eliminazione: anche l'amministratore della Famiglia del contributo.
 */
export function richiediMemoria(db: Db, u: UtenteCorrente, id: string, livello: 'lettura' | 'modifica' | 'elimina', cosa = 'Ricordo'): repoMemoria.RigaMemoria {
  const m = repoMemoria.leggiMemoria(db, id)
  if (!m || !m.piatto_id) throw nonTrovato(cosa)
  const vede = repoMemoria.memoriaLeggibile(db, m.piatto_id, u.id) || (m.tipo === 'storia' && m.pubblica === 1 && repo.piattoLeggibileDaAltri(db, m.piatto_id, u.id))
  if (!vede) throw nonTrovato(cosa)
  if (livello === 'lettura') return m
  const autore = m.tipo === 'storia' ? repo.proprietarioPiatto(db, m.piatto_id) === u.id : m.autore_id === u.id
  if (autore) return m
  if (livello === 'elimina' && m.gruppo_id && repo.ruoloNelGruppo(db, m.gruppo_id, u.id) === 'amministratore') return m
  throw accessoNegato('Lo modifica solo chi l\'ha scritto')
}

/** Membro del gruppo familiare: altrimenti il gruppo «non esiste». */
export function richiediGruppo(db: Db, u: UtenteCorrente, gruppoId: string, livello: 'membro' | 'amministratore' = 'membro'): void {
  const ruolo = repo.ruoloNelGruppo(db, gruppoId, u.id)
  if (!ruolo) throw nonTrovato('Gruppo')
  if (livello === 'amministratore' && ruolo !== 'amministratore') throw accessoNegato('Solo chi amministra la famiglia può farlo')
}

export function richiediAmministratore(u: UtenteCorrente): void {
  if (u.ruolo !== 'amministratore') throw accessoNegato('Funzione riservata all\'amministratore')
}

/**
 * Funzioni di sistema (backup, ripristino, esportazione completa): amministratore, dall'ingresso
 * privato o dall'installazione Cloudflare. Dall'ingresso pubblico la rotta risponde come inesistente.
 */
export function richiediSistema(u: UtenteCorrente): void {
  if (u.ingresso === 'pubblico') throw nonTrovato('Risorsa')
  richiediAmministratore(u)
}
