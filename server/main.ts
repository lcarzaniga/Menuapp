// Avvio del backend: configurazione → database → migrazioni → seed → ascolto (SPEC §14.2).
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pacchetto from '../package.json' with { type: 'json' }
import { costruisciApp } from './app.ts'
import { RegistroRipristini } from './backup/ripristino.ts'
import { leggiConfig } from './config.ts'
import { apriDatabase, chiudiDatabase } from './db/connessione.ts'
import { applicaMigrazioni, CODICE_USCITA_CONFIGURAZIONE, ErroreMigrazione } from './db/migrazioni/esegui.ts'
import { eseguiSeed } from './db/seed/seed.ts'

async function avvia(): Promise<void> {
  const config = leggiConfig()
  // In produzione l'identificativo del rilascio è scritto da scripts/rilascia.sh accanto al codice.
  const fileRilascio = join(dirname(fileURLToPath(import.meta.url)), '..', 'rilascio.json')
  if (!process.env.MENUAPP_RILASCIO && existsSync(fileRilascio)) {
    config.rilascio = (JSON.parse(readFileSync(fileRilascio, 'utf8')) as { id: string }).id
  }
  mkdirSync(config.cartellaBackup, { recursive: true })
  const db = apriDatabase(config.percorsoDb)
  const esito = await applicaMigrazioni(db, { cartellaBackup: config.cartellaBackup })
  if (esito.applicate.length > 0) {
    console.log(`Migrazioni applicate: ${esito.applicate.join(', ')} (backup: ${esito.backup ?? 'nessuno'})`)
  }
  eseguiSeed(db)

  const ripristini = new RegistroRipristini(join(config.cartellaDati, 'ripristino-temp'))
  await ripristini.pulisciTutto()
  const ctx = { db, config, stato: { manutenzione: false }, versioneApp: pacchetto.version, ripristini }
  const app = await costruisciApp(ctx, { log: true })

  let inChiusura = false
  const chiudi = async (segnale: string) => {
    if (inChiusura) return
    inChiusura = true
    console.log(`${segnale}: arresto ordinato`)
    const limite = setTimeout(() => process.exit(1), 5000)
    try {
      await app.close()
    } finally {
      chiudiDatabase(db)
      clearTimeout(limite)
      process.exit(0)
    }
  }
  process.on('SIGTERM', () => void chiudi('SIGTERM'))
  process.on('SIGINT', () => void chiudi('SIGINT'))

  await app.listen({ host: config.host, port: config.porta })
  console.log(
    `Menù & Co. ${pacchetto.version} (${config.rilascio}) su http://${config.host}:${config.porta} — dati in ${config.cartellaDati}`,
  )
}

avvia().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(e instanceof ErroreMigrazione ? CODICE_USCITA_CONFIGURAZIONE : 1)
})
