// Connessione SQLite e transazioni (SPEC §6.3, §12.3).
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite'

export type Db = DatabaseSync
export type Parametro = SQLInputValue | boolean | undefined
export type Riga = Record<string, SQLInputValue>

/** Apre il database con le impostazioni di produzione. */
export function apriDatabase(percorso: string, opzioni: { soloLettura?: boolean } = {}): Db {
  const db = new DatabaseSync(percorso, { readOnly: opzioni.soloLettura ?? false })
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
  if (!opzioni.soloLettura) {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = FULL')
  }
  return db
}

export function chiudiDatabase(db: Db): void {
  if (!db.isOpen) return
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    // database in sola lettura o già chiuso: niente da consolidare
  }
  db.close()
}

const cache = new WeakMap<Db, Map<string, StatementSync>>()

function prepara(db: Db, sql: string): StatementSync {
  let m = cache.get(db)
  if (!m) {
    m = new Map()
    cache.set(db, m)
  }
  let st = m.get(sql)
  if (!st) {
    st = db.prepare(sql)
    m.set(sql, st)
  }
  return st
}

function valori(parametri: Parametro[]): SQLInputValue[] {
  return parametri.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p))
}

export function tutti<T = Riga>(db: Db, sql: string, ...parametri: Parametro[]): T[] {
  return prepara(db, sql).all(...valori(parametri)) as T[]
}

export function uno<T = Riga>(db: Db, sql: string, ...parametri: Parametro[]): T | undefined {
  return prepara(db, sql).get(...valori(parametri)) as T | undefined
}

export function esegui(db: Db, sql: string, ...parametri: Parametro[]): number {
  return Number(prepara(db, sql).run(...valori(parametri)).changes)
}

/**
 * Esegue fn in una transazione di scrittura (BEGIN IMMEDIATE). Se una transazione è già
 * aperta, fn partecipa a quella: l'esito lo decide la transazione esterna.
 */
export function transazione<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) return fn()
  db.exec('BEGIN IMMEDIATE')
  try {
    const risultato = fn()
    if (risultato instanceof Promise) throw new Error('transazione: fn non può essere asincrona')
    db.exec('COMMIT')
    return risultato
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK')
    throw e
  }
}

/** Transazione di sola lettura: istantanea coerente di più letture. */
export function lettura<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) return fn()
  db.exec('BEGIN')
  try {
    return fn()
  } finally {
    if (db.isTransaction) db.exec('COMMIT')
  }
}

export function versioneSchema(db: Db): number {
  return Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
}

export const ora = (): number => Date.now()
