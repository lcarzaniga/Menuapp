// Controllo ottimistico delle versioni (SPEC §12.5).
import { type Db, esegui, type Parametro, uno } from '../db/connessione.ts'
import { conflittoVersione, idEsistente, nonTrovato } from './errori.ts'

/**
 * UPDATE condizionato alla versione letta dal client. Se il record esiste con un'altra
 * versione → 409 con il record attuale; se non esiste → 404.
 */
export function aggiornaConVersione(
  db: Db,
  tabella: string,
  id: string | number,
  versione: number,
  colonne: Record<string, Parametro>,
  leggiAttuale: () => unknown,
  adesso = Date.now(),
): void {
  const nomi = Object.keys(colonne)
  const set = [...nomi.map((c) => `${c} = ?`), 'versione = versione + 1', 'aggiornato_il = ?'].join(', ')
  const modificate = esegui(
    db,
    `UPDATE ${tabella} SET ${set} WHERE id = ? AND versione = ?`,
    ...nomi.map((c) => colonne[c]),
    adesso,
    id,
    versione,
  )
  if (modificate === 1) return
  verificaEsistenza(db, tabella, id, leggiAttuale)
}

/** Dopo un aggiornamento fallito: distingue conflitto e assenza. */
function verificaEsistenza(db: Db, tabella: string, id: string | number, leggiAttuale: () => unknown): never {
  if (uno(db, `SELECT 1 FROM ${tabella} WHERE id = ?`, id)) throw conflittoVersione(leggiAttuale())
  throw nonTrovato()
}

/** Controlla la versione senza modificare (per azioni su più tabelle). */
export function controllaVersione(
  db: Db,
  tabella: string,
  id: string,
  versione: number,
  leggiAttuale: () => unknown,
): void {
  const r = uno<{ versione: number }>(db, `SELECT versione FROM ${tabella} WHERE id = ?`, id)
  if (!r) throw nonTrovato()
  if (r.versione !== versione) throw conflittoVersione(leggiAttuale())
}

/** Incrementa la versione di un aggregato dopo modifiche alle sue parti. */
export function incrementaVersione(db: Db, tabella: string, id: string, adesso = Date.now()): void {
  esegui(db, `UPDATE ${tabella} SET versione = versione + 1, aggiornato_il = ? WHERE id = ?`, adesso, id)
}

/** DELETE condizionato alla versione. */
export function eliminaConVersione(
  db: Db,
  tabella: string,
  id: string,
  versione: number,
  leggiAttuale: () => unknown,
): void {
  if (esegui(db, `DELETE FROM ${tabella} WHERE id = ? AND versione = ?`, id, versione) === 1) return
  verificaEsistenza(db, tabella, id, leggiAttuale)
}

/**
 * Verifica in blocco le versioni di un elenco (riordini): se anche una sola non coincide,
 * nessuna modifica e 409 con lo stato attuale.
 */
export function controllaVersioni(
  db: Db,
  tabella: string,
  voci: { id: string; versione: number }[],
  leggiAttuale: () => unknown,
): void {
  for (const v of voci) {
    const r = uno<{ versione: number }>(db, `SELECT versione FROM ${tabella} WHERE id = ?`, v.id)
    if (!r || r.versione !== v.versione) throw conflittoVersione(leggiAttuale())
  }
}

/**
 * Creazione idempotente con id scelto dal client: se l'id esiste già con lo stesso
 * contenuto la richiesta è una ripetizione (restituisce l'esistente), altrimenti 409.
 */
export function creaIdempotente<T>(
  db: Db,
  tabella: string,
  id: string,
  leggi: () => T | undefined,
  uguale: (esistente: T) => boolean,
  inserisci: () => void,
): { creato: boolean; valore: T } {
  if (uno(db, `SELECT 1 FROM ${tabella} WHERE id = ?`, id)) {
    const esistente = leggi()
    if (esistente !== undefined && uguale(esistente)) return { creato: false, valore: esistente }
    throw idEsistente()
  }
  inserisci()
  const valore = leggi()
  if (valore === undefined) throw new Error(`Creazione in ${tabella} non riuscita`)
  return { creato: true, valore }
}
