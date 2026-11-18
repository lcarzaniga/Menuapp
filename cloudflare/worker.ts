// Worker di Ricette di famiglia & Co. su Cloudflare (SPEC §32): i file dell'app arrivano dagli
// Static Assets; ogni richiesta /api/* passa al Durable Object «Archivio», unica istanza con il
// database SQLite, che esegue le stesse rotte del server Debian sul motore leggero.
import { DurableObject } from 'cloudflare:workers'
import pacchetto from '../package.json' with { type: 'json' }
import type { Contesto } from '../server/api/aiuti.ts'
import { costruisciAppLeggera } from '../server/app-leggera.ts'
import type { Config } from '../server/config.ts'
import { applicaElenco } from '../server/db/migrazioni/applica.ts'
import { eseguiSeed } from '../server/db/seed/seed.ts'
import type { AppLeggera } from '../server/motore-leggero.ts'
import { manutenzioneNotturna } from './backup.ts'
import { CartellaR2 } from './cartella-r2.ts'
import { gestisciConsole, PERCORSO_CONSOLE } from './console.ts'
import { DbDurable } from './db-durable.ts'
import { MIGRAZIONI } from './migrazioni.ts'
import { rotteCloudflare } from './rotte.ts'

export interface Ambiente {
  ARCHIVIO: DurableObjectNamespace<Archivio>
  FOTO: R2Bucket
  ASSETS: Fetcher
  /** Indirizzo dell'app (link d'invito), es. https://ricettedifamiglia.online */
  MENUAPP_URL_PUBBLICO: string
  /** Altre origini ammesse per le scritture, separate da virgole (es. www. o sviluppo). */
  MENUAPP_ORIGINI?: string
  /** Identificativo del rilascio (scripts/cloudflare/rilascia.sh). */
  MENUAPP_RILASCIO?: string
  /** Segreto temporaneo della console amministrativa. */
  MENUAPP_CODICE_CONSOLE?: string
  /** Solo sviluppo e test in locale (HTTP): cookie senza Secure. */
  MENUAPP_COOKIE_SICURO?: string
}

const NOME_ISTANZA = 'archivio'

function configDa(env: Ambiente): Config {
  const pubblico = env.MENUAPP_URL_PUBBLICO
  const origini = [new URL(pubblico).origin, ...(env.MENUAPP_ORIGINI ?? '').split(',').map((s) => s.trim()).filter(Boolean)]
  return {
    host: '',
    porta: 0,
    cartellaDati: '',
    percorsoDb: '',
    cartellaBackup: '',
    cartellaFoto: '',
    cartellaStatici: null,
    origini: [...new Set(origini)],
    rilascio: env.MENUAPP_RILASCIO ?? 'sviluppo',
    portaLan: null,
    hostLan: '',
    urlPubblico: pubblico,
    urlPrivato: null,
    portaPubblica: null,
    cookieSicuro: env.MENUAPP_COOKIE_SICURO !== '0',
  }
}

export class Archivio extends DurableObject<Ambiente> {
  private readonly db: DbDurable
  private readonly foto: CartellaR2
  private readonly contesto: Contesto
  private app!: AppLeggera

  constructor(stato: DurableObjectState, env: Ambiente) {
    super(stato, env)
    this.db = new DbDurable(stato.storage)
    this.foto = new CartellaR2(env.FOTO)
    this.contesto = { db: this.db, config: configDa(env), stato: { manutenzione: false }, versioneApp: pacchetto.version, foto: this.foto }
    // Migrazioni e catalogo prima di qualunque richiesta (blockConcurrencyWhile).
    void stato.blockConcurrencyWhile(async () => {
      await applicaElenco(this.db, MIGRAZIONI)
      eseguiSeed(this.db)
      this.app = costruisciAppLeggera(this.contesto, 'unico', (app) => rotteCloudflare(app, this.contesto, env.FOTO))
    })
  }

  override async fetch(richiesta: Request): Promise<Response> {
    const ip = richiesta.headers.get('cf-connecting-ip') ?? '127.0.0.1'
    const percorso = new URL(richiesta.url).pathname
    if (percorso === PERCORSO_CONSOLE || percorso.startsWith(`${PERCORSO_CONSOLE}/`)) {
      return gestisciConsole(richiesta, {
        db: this.db,
        bucket: this.env.FOTO,
        codice: this.env.MENUAPP_CODICE_CONSOLE,
        urlInviti: this.contesto.config.urlPubblico!,
        versioneApp: this.contesto.versioneApp,
        ip,
        manutenzione: (attiva) => {
          this.contesto.stato.manutenzione = attiva
        },
      })
    }
    try {
      return await this.app.gestisci(richiesta, ip)
    } finally {
      await this.foto.completa()
    }
  }

  /** Manutenzione notturna (Cron Trigger). */
  async notte(): Promise<{ backup: string; nelCestino: number; eliminati: number }> {
    return manutenzioneNotturna(this.db, this.env.FOTO, this.contesto.versioneApp)
  }
}

const archivio = (env: Ambiente) => env.ARCHIVIO.get(env.ARCHIVIO.idFromName(NOME_ISTANZA))

export default {
  async fetch(richiesta: Request, env: Ambiente): Promise<Response> {
    const url = new URL(richiesta.url)
    if (url.pathname.startsWith('/api/')) return archivio(env).fetch(richiesta)
    return env.ASSETS.fetch(richiesta)
  },
  async scheduled(_evento: ScheduledController, env: Ambiente, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(archivio(env).notte().then((esito) => console.log('Manutenzione notturna', JSON.stringify(esito))))
  },
} satisfies ExportedHandler<Ambiente>
