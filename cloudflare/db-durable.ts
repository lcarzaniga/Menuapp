// Database del Durable Object (SPEC §32.2): l'interfaccia `Db` dell'app sopra lo SQLite del
// Durable Object. API sincrona come node:sqlite; transazioni con `transactionSync` (il motore
// non ammette BEGIN/COMMIT) e versione dello schema da `migrazioni_applicate`.
import type { Db, Istruzione, ValoreSql } from '../server/db/connessione.ts'

/** Righe con i BLOB come Uint8Array (il Durable Object li restituisce come ArrayBuffer). */
function riga(r: Record<string, SqlStorageValue>): Record<string, ValoreSql> {
  const out: Record<string, ValoreSql> = {}
  for (const [k, v] of Object.entries(r)) out[k] = v instanceof ArrayBuffer ? new Uint8Array(v) : (v as ValoreSql)
  return out
}

function parametri(valori: ValoreSql[]): SqlStorageValue[] {
  return valori.map((v) => (typeof v === 'bigint' ? Number(v) : v instanceof Uint8Array ? (v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer) : v))
}

export class DbDurable implements Db {
  readonly isOpen = true
  private profondita = 0
  private readonly sql: SqlStorage
  private readonly storage: DurableObjectStorage
  readonly nativo: Db['nativo']

  constructor(storage: DurableObjectStorage) {
    this.storage = storage
    this.sql = storage.sql
    this.nativo = {
      transazione: <T>(fn: () => T): T => {
        this.profondita++
        try {
          return this.storage.transactionSync(fn)
        } finally {
          this.profondita--
        }
      },
    }
  }

  get isTransaction(): boolean {
    return this.profondita > 0
  }

  exec(sql: string): void {
    this.sql.exec(sql)
  }

  prepare(testo: string): Istruzione {
    const sql = this.sql
    return {
      all: (...p) => sql.exec(testo, ...parametri(p)).toArray().map(riga),
      get: (...p) => {
        const righe = sql.exec(testo, ...parametri(p)).toArray()
        return righe[0] ? riga(righe[0]) : undefined
      },
      run: (...p) => {
        sql.exec(testo, ...parametri(p)).toArray()
        // rowsWritten conta anche gli indici: changes() è il numero di righe come in node:sqlite.
        return { changes: Number(sql.exec('SELECT changes() AS n').one().n) }
      },
    }
  }
}
