// SQL delle preferenze personali (SPEC §36).
import { type Db, esegui, uno } from '../connessione.ts'

export interface RigaPreferenze {
  includi_pubbliche: number
  versione: number
}

/** Preferenze dell'utente; senza riga valgono quelle iniziali (versione 0). */
export const leggi = (db: Db, utenteId: string): RigaPreferenze =>
  uno<RigaPreferenze>(db, 'SELECT includi_pubbliche, versione FROM preferenze_utente WHERE utente_id = ?', utenteId) ?? { includi_pubbliche: 0, versione: 0 }

/** Scrive se la versione coincide (0: prima scrittura). Restituisce false in caso di conflitto. */
export function scrivi(db: Db, utenteId: string, includiPubbliche: boolean, versione: number, adesso: number): boolean {
  const valore = includiPubbliche ? 1 : 0
  if (versione === 0) {
    return esegui(db, 'INSERT INTO preferenze_utente (utente_id, includi_pubbliche, versione, aggiornato_il) VALUES (?, ?, 1, ?) ON CONFLICT DO NOTHING', utenteId, valore, adesso) === 1
  }
  return esegui(db, 'UPDATE preferenze_utente SET includi_pubbliche = ?, versione = versione + 1, aggiornato_il = ? WHERE utente_id = ? AND versione = ?', valore, adesso, utenteId, versione) === 1
}
