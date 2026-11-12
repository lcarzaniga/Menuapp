// Rotte di sistema: salute, revisione, impostazioni, reparti.
import type { FastifyInstance } from 'fastify'
import { PREFISSO_API, type Salute } from '../../src/contratto/comune.ts'
import { SchemaAggiornaImpostazioni } from '../../src/contratto/impostazioni.ts'
import { versioneSchema } from '../db/connessione.ts'
import { leggiMeta, revisione } from '../db/repo/meta.ts'
import { aggiornaImpostazioni, elencaReparti, leggiImpostazioni } from '../servizi/impostazioni.ts'
import { type Contesto, valida } from './aiuti.ts'

export function rotteSistema(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx

  app.get(`${PREFISSO_API}/salute`, async (): Promise<Salute> => ({
    ok: !ctx.stato.manutenzione,
    versioneApp: ctx.versioneApp,
    versioneApi: 1,
    versioneSchema: versioneSchema(db),
    rilascio: ctx.config.rilascio,
    revisione: revisione(db),
    ultimoBackup: leggiMeta<Salute['ultimoBackup']>(db, 'ultimo_backup') ?? null,
  }))

  app.get(`${PREFISSO_API}/revisione`, async () => ({ revisione: revisione(db) }))

  app.get(`${PREFISSO_API}/impostazioni`, async () => leggiImpostazioni(db))

  app.put(`${PREFISSO_API}/impostazioni`, async (req) =>
    aggiornaImpostazioni(db, valida(SchemaAggiornaImpostazioni, req.body)),
  )

  app.get(`${PREFISSO_API}/reparti`, async () => elencaReparti(db))
}
