// Esecuzione delle migrazioni all'avvio del server (SPEC §6.5): file in questa cartella,
// backup verificato prima di modificare un database in uso.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { creaBackup } from '../../backup/backup.ts'
import type { Db } from '../connessione.ts'
import { applicaElenco, ErroreMigrazione, type EsitoMigrazioni, type Migrazione } from './applica.ts'

export { CODICE_USCITA_CONFIGURAZIONE, ErroreMigrazione, type EsitoMigrazioni, type Migrazione } from './applica.ts'

export const CARTELLA_MIGRAZIONI = dirname(fileURLToPath(import.meta.url))

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

/**
 * Porta il database all'ultima versione. Prima di modificare un database già in uso
 * crea un backup verificato; ogni migrazione è una transazione con user_version.
 */
export async function applicaMigrazioni(
  db: Db,
  opzioni: { cartellaBackup: string | null; cartellaMigrazioni?: string; fino?: number },
): Promise<EsitoMigrazioni> {
  const { cartellaBackup } = opzioni
  const migrazioni = elencaMigrazioni(opzioni.cartellaMigrazioni).slice(0, opzioni.fino)
  return applicaElenco(db, migrazioni, cartellaBackup === null ? undefined : async () => (await creaBackup(db, cartellaBackup, 'pre-migrazione')).nome)
}
