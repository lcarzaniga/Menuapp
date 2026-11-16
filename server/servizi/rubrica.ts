// Rubrica delle persone senza account di una Famiglia (SPEC §22): parenti e amici che non usano
// l'app, da indicare come responsabili degli incarichi. La gestiscono i membri della Famiglia;
// nessun'altra Famiglia la vede. Non sono utenti: nessuna identità, sessione o permesso.
import { randomUUID } from 'node:crypto'
import type { Esterno } from '../../src/contratto/famiglia.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import { type Db, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { conflittoVersione, nonTrovato, regolaViolata } from './errori.ts'
import { richiediGruppo, type UtenteCorrente } from './permessi.ts'

const daRiga = (r: repo.RigaEsterno): Esterno => ({ id: r.id, nome: r.nome, note: r.note, versione: r.versione })

export function elenca(db: Db, u: UtenteCorrente, gruppoId: string): Esterno[] {
  richiediGruppo(db, u, gruppoId)
  return repo.rubrica(db, gruppoId).map(daRiga)
}

/** Niente doppioni: né un'altra voce della rubrica né un membro della Famiglia con lo stesso nome. */
function controllaNome(db: Db, gruppoId: string, nome: string, escluso?: string): void {
  const chiave = norm(nome)
  const altro = repo.esternoPerNome(db, gruppoId, chiave)
  if (altro && altro.id !== escluso) throw regolaViolata('nome_in_rubrica', `${altro.nome} è già nella rubrica`)
  const membro = repoAccesso.membriGruppo(db, gruppoId).find((m) => norm(m.nome) === chiave)
  if (membro) throw regolaViolata('nome_di_un_membro', `${membro.nome} usa già l'app in questa Famiglia`)
}

function richiediEsterno(db: Db, u: UtenteCorrente, id: string): repo.RigaEsterno {
  const e = repo.leggiEsterno(db, id)
  if (!e || !repoAccesso.ruoloNelGruppo(db, e.gruppo_id, u.id)) throw nonTrovato('Persona')
  return e
}

export function crea(db: Db, u: UtenteCorrente, gruppoId: string, d: { id?: string; nome: string; note: string }, adesso = Date.now()): Esterno {
  return transazione(db, () => {
    richiediGruppo(db, u, gruppoId)
    const nome = pulisci(d.nome)
    const id = d.id ?? randomUUID()
    const esistente = repo.leggiEsterno(db, id)
    if (esistente) {
      if (esistente.gruppo_id === gruppoId && esistente.nome === nome) return daRiga(esistente) // ripetizione
      throw regolaViolata('id_esistente', 'Identificativo già usato')
    }
    controllaNome(db, gruppoId, nome)
    repo.inserisciEsterno(db, { id, gruppoId, nome, nomeNorm: norm(nome), note: pulisci(d.note), creatoDa: u.id }, adesso)
    incrementaRevisione(db)
    return daRiga(repo.leggiEsterno(db, id)!)
  })
}

/** Il nome cambiato segue negli incarichi ancora affidati alla persona. */
export function aggiorna(db: Db, u: UtenteCorrente, id: string, d: { nome: string; note: string; versione: number }, adesso = Date.now()): Esterno {
  return transazione(db, () => {
    const e = richiediEsterno(db, u, id)
    const nome = pulisci(d.nome)
    controllaNome(db, e.gruppo_id, nome, id)
    if (repo.aggiornaEsterno(db, id, d.versione, { nome, nomeNorm: norm(nome), note: pulisci(d.note) }, adesso) !== 1) throw conflittoVersione(daRiga(e))
    if (nome !== e.nome) repo.rinominaInIncarichi(db, id, nome)
    incrementaRevisione(db)
    return daRiga(repo.leggiEsterno(db, id)!)
  })
}

/** Togliere dalla rubrica non cancella gli incarichi: restano con il nome scritto in «A cura di». */
export function elimina(db: Db, u: UtenteCorrente, id: string): void {
  transazione(db, () => {
    richiediEsterno(db, u, id)
    repo.eliminaEsterno(db, id)
    incrementaRevisione(db)
  })
}

export const richiedi = richiediEsterno
