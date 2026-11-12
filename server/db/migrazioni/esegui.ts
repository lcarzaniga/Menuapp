// Esecuzione delle migrazioni all'avvio (SPEC §6.5).
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { creaBackup } from '../../backup/backup.ts'
import { type Db, esegui, tutti, versioneSchema } from '../connessione.ts'

export const CARTELLA_MIGRAZIONI = dirname(fileURLToPath(import.meta.url))

/** Codice d'uscita che il servizio systemd non ripete (RestartPreventExitStatus=78). */
export const CODICE_USCITA_CONFIGURAZIONE = 78

export class ErroreMigrazione extends Error {
  readonly codiceUscita = CODICE_USCITA_CONFIGURAZIONE
}

export interface Migrazione {
  versione: number
  nome: string
  sql: string
  sha256: string
}

export function elencaMigrazioni(cartella = CARTELLA_MIGRAZIONI): Migrazione[] {
  const file = readdirSync(cartella)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
  return file.map((f, i) => {
    const versione = Number(f.slice(0, 4))
    if (versione !== i + 1) throw new ErroreMigrazione(`Numerazione delle migrazioni non continua: ${f}`)
    const sql = readFileSync(join(cartella, f), 'utf8')
    return { versione, nome: f, sql, sha256: createHash('sha256').update(sql).digest('hex') }
  })
}

export function ultimaVersione(cartella = CARTELLA_MIGRAZIONI): number {
  return elencaMigrazioni(cartella).length
}

export interface EsitoMigrazioni {
  versionePrima: number
  versioneDopo: number
  applicate: string[]
  backup: string | null
}

/**
 * Porta il database all'ultima versione. Prima di modificare un database già in uso
 * crea un backup verificato; ogni migrazione è una transazione con user_version.
 */
export async function applicaMigrazioni(
  db: Db,
  opzioni: { cartellaBackup: string | null; cartellaMigrazioni?: string; fino?: number },
): Promise<EsitoMigrazioni> {
  const migrazioni = elencaMigrazioni(opzioni.cartellaMigrazioni).slice(0, opzioni.fino)
  const versionePrima = versioneSchema(db)
  const ultima = migrazioni.length

  if (versionePrima > ultima) {
    throw new ErroreMigrazione(
      `Il database è alla versione ${versionePrima}, il codice conosce fino alla ${ultima}: rilascio più vecchio del database`,
    )
  }

  db.exec(`CREATE TABLE IF NOT EXISTS migrazioni_applicate (
    versione INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    applicata_il INTEGER NOT NULL
  ) STRICT`)

  const registrate = tutti<{ versione: number; nome: string; sha256: string }>(
    db,
    'SELECT versione, nome, sha256 FROM migrazioni_applicate ORDER BY versione',
  )
  for (const r of registrate) {
    const m = migrazioni[r.versione - 1]
    if (!m || m.sha256 !== r.sha256) {
      throw new ErroreMigrazione(`La migrazione ${r.nome} è stata modificata dopo essere stata applicata`)
    }
  }

  const daApplicare = migrazioni.slice(versionePrima)
  if (daApplicare.length === 0) return { versionePrima, versioneDopo: versionePrima, applicate: [], backup: null }

  let backup: string | null = null
  if (versionePrima > 0 && opzioni.cartellaBackup !== null) {
    try {
      backup = (await creaBackup(db, opzioni.cartellaBackup, 'pre-migrazione')).nome
    } catch (e) {
      throw new ErroreMigrazione(`Backup pre-migrazione fallito, nessuna migrazione applicata: ${(e as Error).message}`)
    }
  }

  const applicate: string[] = []
  for (const m of daApplicare) {
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(m.sql)
      esegui(
        db,
        'INSERT INTO migrazioni_applicate (versione, nome, sha256, applicata_il) VALUES (?, ?, ?, ?)',
        m.versione,
        m.nome,
        m.sha256,
        Date.now(),
      )
      db.exec(`PRAGMA user_version = ${m.versione}`)
      const fk = tutti(db, 'PRAGMA foreign_key_check')
      if (fk.length > 0) throw new Error(`${fk.length} riferimenti non validi dopo la migrazione`)
      db.exec('COMMIT')
      applicate.push(m.nome)
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK')
      throw new ErroreMigrazione(`Migrazione ${m.nome} fallita e annullata: ${(e as Error).message}`)
    }
  }

  const integrita = tutti<{ integrity_check: string }>(db, 'PRAGMA integrity_check')
  if (integrita[0]?.integrity_check !== 'ok') throw new ErroreMigrazione('Verifica di integrità fallita dopo le migrazioni')

  return { versionePrima, versioneDopo: versioneSchema(db), applicate, backup }
}
