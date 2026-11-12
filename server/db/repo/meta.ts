// Tabella meta: revisione globale, versioni dei seed, esito dell'ultimo backup.
import { type Db, esegui, uno } from '../connessione.ts'

export function leggiMeta<T>(db: Db, chiave: string): T | undefined {
  const r = uno<{ valore: string }>(db, 'SELECT valore FROM meta WHERE chiave = ?', chiave)
  return r ? (JSON.parse(r.valore) as T) : undefined
}

export function scriviMeta(db: Db, chiave: string, valore: unknown): void {
  esegui(
    db,
    'INSERT INTO meta (chiave, valore) VALUES (?, ?) ON CONFLICT (chiave) DO UPDATE SET valore = excluded.valore',
    chiave,
    JSON.stringify(valore),
  )
}

export function revisione(db: Db): number {
  return leggiMeta<number>(db, 'revisione') ?? 0
}

/** Incrementa la revisione globale (SPEC §12.6). Da chiamare dentro la transazione di scrittura. */
export function incrementaRevisione(db: Db): number {
  const nuova = revisione(db) + 1
  scriviMeta(db, 'revisione', nuova)
  return nuova
}
