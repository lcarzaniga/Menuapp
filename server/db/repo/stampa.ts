// SQL degli stili di stampa (uno per evento).
import { type Db, esegui, uno } from '../connessione.ts'

export interface RigaStile {
  evento_id: string
  opzioni: string
  versione: number
  creato_il: number
  aggiornato_il: number
}

export function leggiStile(db: Db, eventoId: string): RigaStile | undefined {
  return uno<RigaStile>(db, 'SELECT * FROM stili_stampa WHERE evento_id = ?', eventoId)
}

export function inserisciStile(db: Db, eventoId: string, opzioni: string, adesso: number): void {
  esegui(db, 'INSERT INTO stili_stampa (evento_id, opzioni, versione, creato_il, aggiornato_il) VALUES (?, ?, 1, ?, ?)', eventoId, opzioni, adesso, adesso)
}

/** Aggiornamento condizionato alla versione: restituisce il numero di righe modificate. */
export function aggiornaStile(db: Db, eventoId: string, versione: number, opzioni: string, adesso: number): number {
  return esegui(
    db,
    'UPDATE stili_stampa SET opzioni = ?, versione = versione + 1, aggiornato_il = ? WHERE evento_id = ? AND versione = ?',
    opzioni,
    adesso,
    eventoId,
    versione,
  )
}
