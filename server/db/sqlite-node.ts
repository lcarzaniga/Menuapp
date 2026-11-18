// Apertura del database con node:sqlite (server Debian, test, console, backup).
import { DatabaseSync } from 'node:sqlite'

/** Apre il database con le impostazioni di produzione. */
export function apriDatabase(percorso: string, opzioni: { soloLettura?: boolean } = {}): DatabaseSync {
  const db = new DatabaseSync(percorso, { readOnly: opzioni.soloLettura ?? false })
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
  if (!opzioni.soloLettura) {
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = FULL')
  }
  return db
}

export function chiudiDatabase(db: DatabaseSync): void {
  if (!db.isOpen) return
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch {
    // database in sola lettura o già chiuso: niente da consolidare
  }
  db.close()
}
