// Rotte di sistema: salute, revisione, impostazioni, reparti.
import type { FastifyInstance } from 'fastify'
import { PREFISSO_API, type Salute } from '../../src/contratto/comune.ts'
import { SchemaAggiornaImpostazioni } from '../../src/contratto/impostazioni.ts'
import { versioneSchema } from '../db/connessione.ts'
import { leggiMeta, revisione } from '../db/repo/meta.ts'
import { aggiornaImpostazioni, elencaReparti, leggiImpostazioni } from '../servizi/impostazioni.ts'
import type { Ingresso } from '../../src/contratto/accesso.ts'
import { richiediAmministratore } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

export function rotteSistema(app: FastifyInstance, ctx: Contesto, ingresso: Ingresso): void {
  const { db } = ctx

  // Pubblica: sull'ingresso esterno, senza sessione, dice solo se il servizio risponde.
  app.get(`${PREFISSO_API}/salute`, async (req): Promise<Salute | { ok: boolean; versioneApi: 1 }> => ingresso === 'pubblico' && !req.utente ? { ok: !ctx.stato.manutenzione, versioneApi: 1 } : ({
    ok: !ctx.stato.manutenzione,
    versioneApp: ctx.versioneApp,
    versioneApi: 1,
    versioneSchema: versioneSchema(db),
    rilascio: ctx.config.rilascio,
    revisione: revisione(db),
    ultimoBackup: leggiMeta<Salute['ultimoBackup']>(db, 'ultimo_backup') ?? null,
  }))

  app.get(`${PREFISSO_API}/revisione`, async (req) => {
    chi(req)
    return { revisione: revisione(db) }
  })

  app.get(`${PREFISSO_API}/impostazioni`, async (req) => {
    chi(req)
    return leggiImpostazioni(db)
  })

  // Impostazioni comuni (coefficiente bambini, portate proposte): le cambia l'amministratore.
  app.put(`${PREFISSO_API}/impostazioni`, async (req) => {
    richiediAmministratore(chi(req))
    return aggiornaImpostazioni(db, valida(SchemaAggiornaImpostazioni, req.body))
  })

  app.get(`${PREFISSO_API}/reparti`, async (req) => {
    chi(req)
    return elencaReparti(db)
  })
}
