// Aiutanti per i test del server: SQLite reale in una cartella temporanea.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apriDatabase, chiudiDatabase, type Db } from './db/connessione.ts'
import { applicaMigrazioni } from './db/migrazioni/esegui.ts'
import { eseguiSeed } from './db/seed/seed.ts'

export interface DbDiProva {
  db: Db
  cartella: string
  percorso: string
  cartellaBackup: string
  chiudi: () => void
}

export function cartellaTemporanea(prefisso = 'menuapp-test-'): { cartella: string; elimina: () => void } {
  const cartella = mkdtempSync(join(tmpdir(), prefisso))
  return { cartella, elimina: () => rmSync(cartella, { recursive: true, force: true }) }
}

export async function dbDiProva(opzioni: { seed?: boolean } = {}): Promise<DbDiProva> {
  const { cartella, elimina } = cartellaTemporanea()
  const percorso = join(cartella, 'menuapp.db')
  const cartellaBackup = join(cartella, 'backup')
  const db = apriDatabase(percorso)
  await applicaMigrazioni(db, { cartellaBackup })
  if (opzioni.seed !== false) eseguiSeed(db)
  return {
    db,
    cartella,
    percorso,
    cartellaBackup,
    chiudi: () => {
      chiudiDatabase(db)
      elimina()
    },
  }
}
