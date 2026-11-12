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

import type { FastifyInstance, InjectOptions } from 'fastify'
import { costruisciApp } from './app.ts'
import type { Contesto } from './api/aiuti.ts'
import { leggiConfig } from './config.ts'
import { RegistroRipristini } from './backup/ripristino.ts'

type Risposta = Awaited<ReturnType<FastifyInstance['inject']>>

export const ORIGINE_PROVA = 'http://localhost:5173'

export interface AppDiProva extends DbDiProva {
  app: FastifyInstance
  ctx: Contesto
  /** Richiesta di scrittura come la farebbe il browser (Origin + JSON). */
  scrivi: (metodo: 'POST' | 'PUT' | 'DELETE', url: string, corpo?: unknown) => Promise<Risposta>
  leggi: (url: string) => Promise<Risposta>
  inietta: (o: InjectOptions) => Promise<Risposta>
}

export async function appDiProva(opzioni: { statici?: string; lan?: boolean } = {}): Promise<AppDiProva> {
  const p = await dbDiProva()
  const config = {
    ...leggiConfig({ MENUAPP_DATI: p.cartella, MENUAPP_ORIGINI: ORIGINE_PROVA }),
    cartellaStatici: opzioni.statici ?? null,
  }
  const ctx: Contesto = {
    db: p.db,
    config,
    stato: { manutenzione: false },
    versioneApp: '0.0.0-test',
    ripristini: new RegistroRipristini(join(p.cartella, 'ripristino-temp')),
  }
  const app = await costruisciApp(ctx, { lan: opzioni.lan })
  const scrivi: AppDiProva['scrivi'] = async (metodo, url, corpo) =>
    app.inject({
      method: metodo,
      url,
      headers: corpo === undefined ? { origin: ORIGINE_PROVA } : { origin: ORIGINE_PROVA, 'content-type': 'application/json' },
      ...(corpo === undefined ? {} : { payload: JSON.stringify(corpo) }),
    })
  return {
    ...p,
    app,
    ctx,
    scrivi,
    leggi: async (url) => app.inject({ method: 'GET', url }),
    inietta: async (o) => app.inject(o),
    chiudi: () => {
      void app.close()
      p.chiudi()
    },
  }
}
