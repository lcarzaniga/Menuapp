// Backup dal timer systemd: `node server/backup/cli.ts giornaliero` (SPEC §11.2, §14.3).
// Apre il database in un processo separato: in WAL la copia a caldo è coerente mentre il
// servizio continua a scrivere.
import { leggiConfig } from '../config.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { eseguiBackup } from '../servizi/backup.ts'
import { TIPI_BACKUP, type TipoBackup } from './backup.ts'

const tipo = (process.argv[2] ?? 'giornaliero') as TipoBackup
if (!TIPI_BACKUP.includes(tipo)) {
  console.error(`Tipo di backup sconosciuto: ${tipo}. Ammessi: ${TIPI_BACKUP.join(', ')}`)
  process.exit(2)
}
const config = leggiConfig()
const db = apriDatabase(config.percorsoDb)
try {
  const info = await eseguiBackup(db, config.cartellaBackup, tipo, config.cartellaFoto)
  console.log(`Backup ${tipo} verificato: ${info.nome} (${info.byte} byte, schema v${info.versioneSchema})`)
} catch (e) {
  console.error(`Backup ${tipo} non riuscito: ${(e as Error).message}`)
  process.exitCode = 1
} finally {
  chiudiDatabase(db)
}
