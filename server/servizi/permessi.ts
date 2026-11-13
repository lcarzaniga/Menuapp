// Autorizzazione: chi può fare cosa su eventi, piatti e risorse figlie (SPEC §19.3).
// Una risorsa che l'utente non può vedere risponde come inesistente (404); una visibile
// ma non modificabile risponde 403 con il motivo.
import type { Ingresso, PermessoEvento, Ruolo } from '../../src/contratto/accesso.ts'
import type { Db } from '../db/connessione.ts'
import * as repo from '../db/repo/accesso.ts'
import { accessoNegato, nonTrovato } from './errori.ts'

export interface UtenteCorrente {
  id: string
  nome: string
  ruolo: Ruolo
  sessioneId: string
  ingresso: Ingresso
}

export type LivelloEvento = 'lettura' | 'modifica' | 'proprietario'

export function permessoEvento(db: Db, u: UtenteCorrente, eventoId: string): PermessoEvento | null {
  const a = repo.accessoEvento(db, eventoId, u.id)
  if (!a) return null
  if (a.proprietario_id === u.id) return 'proprietario'
  return a.permesso
}

const SUFFICIENTE: Record<LivelloEvento, PermessoEvento[]> = {
  lettura: ['lettura', 'modifica', 'proprietario'],
  modifica: ['modifica', 'proprietario'],
  proprietario: ['proprietario'],
}

/** Verifica l'accesso all'evento; `cosa` è il nome della risorsa da citare nel 404. */
export function richiediEvento(db: Db, u: UtenteCorrente, eventoId: string, livello: LivelloEvento, cosa = 'Evento'): PermessoEvento {
  const p = permessoEvento(db, u, eventoId)
  if (!p) throw nonTrovato(cosa)
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
  richiediPiatto(db, u, piatto, livello, 'Foto')
  return piatto
}

export function richiediAmministratore(u: UtenteCorrente): void {
  if (u.ruolo !== 'amministratore') throw accessoNegato('Funzione riservata all\'amministratore')
}

/**
 * Funzioni di sistema (backup, ripristino, esportazione completa): amministratore e solo
 * dall'ingresso privato. Dall'ingresso pubblico la rotta risponde come inesistente.
 */
export function richiediSistema(u: UtenteCorrente): void {
  if (u.ingresso !== 'privato') throw nonTrovato('Risorsa')
  richiediAmministratore(u)
}
