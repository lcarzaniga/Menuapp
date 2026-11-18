// Applicazione delle migrazioni, comune al server e al Durable Object (SPEC §6.5, §32):
// nessun accesso a file, l'elenco e il backup arrivano da chi chiama.
import { type Db, esegui, transazione, tutti, versioneSchema } from '../connessione.ts'

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

export interface EsitoMigrazioni {
  versionePrima: number
  versioneDopo: number
  applicate: string[]
  backup: string | null
}

/**
 * Porta il database all'ultima versione dell'elenco. Prima di modificare un database già in
 * uso chiama `backup` (se c'è); ogni migrazione è una transazione.
 */
export async function applicaElenco(db: Db, migrazioni: Migrazione[], backupPrima?: () => Promise<string>): Promise<EsitoMigrazioni> {
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
  if (versionePrima > 0 && backupPrima) {
    try {
      backup = await backupPrima()
    } catch (e) {
      throw new ErroreMigrazione(`Backup pre-migrazione fallito, nessuna migrazione applicata: ${(e as Error).message}`)
    }
  }

  const applicate: string[] = []
  for (const m of daApplicare) {
    try {
      transazione(db, () => {
        db.exec(m.sql)
        esegui(
          db,
          'INSERT INTO migrazioni_applicate (versione, nome, sha256, applicata_il) VALUES (?, ?, ?, ?)',
          m.versione,
          m.nome,
          m.sha256,
          Date.now(),
        )
        // Il Durable Object non ammette user_version: lì la versione è in migrazioni_applicate.
        if (!db.nativo) db.exec(`PRAGMA user_version = ${m.versione}`)
        const fk = tutti(db, 'PRAGMA foreign_key_check')
        if (fk.length > 0) throw new Error(`${fk.length} riferimenti non validi dopo la migrazione`)
      })
      applicate.push(m.nome)
    } catch (e) {
      throw new ErroreMigrazione(`Migrazione ${m.nome} fallita e annullata: ${(e as Error).message}`)
    }
  }

  // integrity_check non è ammesso nel Durable Object (lì l'integrità la garantisce la piattaforma).
  const integrita = db.nativo ? [{ integrity_check: 'ok' }] : tutti<{ integrity_check: string }>(db, 'PRAGMA integrity_check')
  if (integrita[0]?.integrity_check !== 'ok') throw new ErroreMigrazione('Verifica di integrità fallita dopo le migrazioni')

  return { versionePrima, versioneDopo: versioneSchema(db), applicate, backup }
}
