// Connessione SQLite e transazioni (SPEC §6.3, §12.3). Il motore è `node:sqlite` sul server
// (apertura in `sqlite-node.ts`) o lo SQLite di un Durable Object su Cloudflare (SPEC §32):
// qui solo ciò che vale per entrambi.

/** Valore accettato da SQLite come parametro o restituito in una colonna. */
export type ValoreSql = null | number | bigint | string | Uint8Array
export type Parametro = ValoreSql | boolean | undefined
export type Riga = Record<string, ValoreSql>

export interface Istruzione {
  all(...parametri: ValoreSql[]): unknown[]
  get(...parametri: ValoreSql[]): unknown
  run(...parametri: ValoreSql[]): { changes: number | bigint }
}

/** Il sottoinsieme di `DatabaseSync` usato dall'app; `DatabaseSync` lo soddisfa così com'è. */
export interface Db {
  prepare(sql: string): Istruzione
  exec(sql: string): void
  readonly isOpen: boolean
  readonly isTransaction: boolean
  /**
   * Motore senza BEGIN/COMMIT e senza `PRAGMA user_version` (Durable Object): transazioni con
   * l'API del motore, versione dello schema da `migrazioni_applicate`.
   */
  readonly nativo?: { transazione<T>(fn: () => T): T }
}

const cache = new WeakMap<Db, Map<string, Istruzione>>()

/**
 * Dimentica le istruzioni preparate: dopo un cambio di schema (migrazioni) un `SELECT *` preparato
 * prima può restituire le colonne di prima (succede con alcune versioni di node:sqlite).
 */
export function dimenticaIstruzioni(db: Db): void {
  cache.delete(db)
}

function prepara(db: Db, sql: string): Istruzione {
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

function valori(parametri: Parametro[]): ValoreSql[] {
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
  if (db.nativo) {
    return db.nativo.transazione(() => {
      const risultato = fn()
      if (risultato instanceof Promise) throw new Error('transazione: fn non può essere asincrona')
      return risultato
    })
  }
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
  // Durable Object: una richiesta alla volta, nessuna scrittura concorrente durante fn.
  if (db.nativo) return db.nativo.transazione(fn)
  db.exec('BEGIN')
  try {
    return fn()
  } finally {
    if (db.isTransaction) db.exec('COMMIT')
  }
}

export function versioneSchema(db: Db): number {
  if (db.nativo) {
    const tabella = uno(db, "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migrazioni_applicate'")
    return tabella ? Number(uno<{ v: number | null }>(db, 'SELECT max(versione) AS v FROM migrazioni_applicate')?.v ?? 0) : 0
  }
  return Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
}

export const ora = (): number => Date.now()
