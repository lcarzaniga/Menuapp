// Gruppi familiari (SPEC §20.1): appartenenza esplicita; oggi un gruppo, il modello ne ammette altri.
import type { Gruppo } from '../../src/contratto/famiglia.ts'
import { type Db, transazione } from '../db/connessione.ts'
import * as repo from '../db/repo/accesso.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { nonTrovato, regolaViolata } from './errori.ts'
import type { UtenteCorrente } from './permessi.ts'

const conMembri = (db: Db, g: { id: string; nome: string }, ruolo: Gruppo['ruolo']): Gruppo => ({
  id: g.id,
  nome: g.nome,
  ruolo,
  membri: repo.membriGruppo(db, g.id).map((m) => ({ id: m.utente_id, nome: m.nome })),
})

/** Gruppi di cui l'utente fa parte, con i membri. */
export const gruppiDi = (db: Db, u: UtenteCorrente): Gruppo[] => repo.gruppiDiUtente(db, u.id).map((g) => conMembri(db, g, g.ruolo))

/** Tutti i gruppi con i membri e il loro ruolo (amministrazione). */
export const tuttiIGruppi = (db: Db) =>
  repo.elencaGruppi(db).map((g) => ({ id: g.id, nome: g.nome, membri: repo.membriGruppo(db, g.id).map((m) => ({ id: m.utente_id, nome: m.nome, ruolo: m.ruolo })) }))

export function impostaMembro(db: Db, gruppoId: string, utenteId: string, ruolo: 'amministratore' | 'membro', adesso = Date.now()) {
  return transazione(db, () => {
    if (!repo.elencaGruppi(db).some((g) => g.id === gruppoId)) throw nonTrovato('Gruppo')
    if (!repo.leggiUtente(db, utenteId)) throw nonTrovato('Utente')
    repo.aggiungiMembro(db, gruppoId, utenteId, ruolo, adesso)
    incrementaRevisione(db)
    return tuttiIGruppi(db).find((g) => g.id === gruppoId)!
  })
}

export function togliMembro(db: Db, gruppoId: string, utenteId: string): void {
  transazione(db, () => {
    const membri = repo.membriGruppo(db, gruppoId)
    const resta = membri.filter((m) => m.utente_id !== utenteId)
    if (membri.some((m) => m.utente_id === utenteId && m.ruolo === 'amministratore') && !resta.some((m) => m.ruolo === 'amministratore')) {
      throw regolaViolata('ultimo_amministratore', 'Il gruppo deve avere almeno un amministratore')
    }
    repo.togliMembro(db, gruppoId, utenteId)
    incrementaRevisione(db)
  })
}
