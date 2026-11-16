// SQL delle ricorrenze di una Famiglia (SPEC §28).
import { type Db, esegui, tutti, uno } from '../connessione.ts'

export interface RigaRicorrenza {
  id: string
  gruppo_id: string
  nome: string
  nome_norm: string
  descrizione: string
  versione: number
  eventi: number
}

const SELEZIONE = 'SELECT r.*, (SELECT count(*) FROM eventi e WHERE e.ricorrenza_id = r.id) AS eventi FROM ricorrenze r'

export const ricorrenzeFamiglia = (db: Db, gruppoId: string) => tutti<RigaRicorrenza>(db, `${SELEZIONE} WHERE r.gruppo_id = ? ORDER BY r.nome_norm`, gruppoId)
export const leggiRicorrenza = (db: Db, id: string) => uno<RigaRicorrenza>(db, `${SELEZIONE} WHERE r.id = ?`, id)

export function inserisciRicorrenza(db: Db, r: { id: string; gruppoId: string; nome: string; nomeNorm: string; descrizione: string; creatoDa: string }, adesso: number): void {
  esegui(
    db,
    'INSERT INTO ricorrenze (id, gruppo_id, nome, nome_norm, descrizione, creato_da, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    r.id, r.gruppoId, r.nome, r.nomeNorm, r.descrizione, r.creatoDa, adesso, adesso,
  )
}

export const aggiornaRicorrenza = (db: Db, id: string, versione: number, r: { nome: string; nomeNorm: string; descrizione: string }, adesso: number) =>
  esegui(db, 'UPDATE ricorrenze SET nome = ?, nome_norm = ?, descrizione = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ? AND versione = ?', r.nome, r.nomeNorm, r.descrizione, adesso, id, versione)

/** Gli eventi restano: perdono solo l'associazione (ON DELETE SET NULL). */
export const eliminaRicorrenza = (db: Db, id: string) => esegui(db, 'DELETE FROM ricorrenze WHERE id = ?', id)
