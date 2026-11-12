// Rotte di backup, esportazione e ripristino (SPEC §11).
import { createReadStream } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { SchemaEseguiRipristino, SchemaRichiestaVerifica } from '../../src/contratto/backup.ts'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { percorsoBackup, RE_NOME_BACKUP } from '../backup/backup.ts'
import { esporta, nomeFileEsportazione } from '../backup/esportazione.ts'
import { eseguiRipristino, verificaRipristino } from '../backup/ripristino.ts'
import { LIMITE_CORPO_RIPRISTINO } from '../app.ts'
import { eseguiBackup, registraEsportazione, statoBackup } from '../servizi/backup.ts'
import { nonTrovato, richiestaNonValida } from '../servizi/errori.ts'
import { type Contesto, valida } from './aiuti.ts'

export function rotteBackup(app: FastifyInstance, ctx: Contesto): void {
  const { db, config } = ctx

  app.get(`${PREFISSO_API}/backup`, async () => statoBackup(db, config.cartellaBackup))

  app.post(`${PREFISSO_API}/backup`, async (_req, reply) => {
    const info = await eseguiBackup(db, config.cartellaBackup, 'manuale')
    return reply.code(201).send(info)
  })

  app.get<{ Params: { nome: string } }>(`${PREFISSO_API}/backup/:nome`, async (req, reply) => {
    if (!RE_NOME_BACKUP.test(req.params.nome)) throw richiestaNonValida('Nome di backup non valido')
    const percorso = percorsoBackup(config.cartellaBackup, req.params.nome)
    const flusso = createReadStream(percorso)
    await new Promise<void>((ok, ko) => {
      flusso.once('open', () => ok())
      flusso.once('error', () => ko(nonTrovato('Backup')))
    })
    return reply
      .header('content-type', 'application/vnd.sqlite3')
      .header('content-disposition', `attachment; filename="menuapp-${req.params.nome}"`)
      .send(flusso)
  })

  app.get(`${PREFISSO_API}/esportazione`, async (_req, reply) => {
    const adesso = new Date()
    const e = esporta(db, ctx.versioneApp, adesso)
    registraEsportazione(db, adesso)
    return reply
      .header('content-disposition', `attachment; filename="${nomeFileEsportazione(adesso)}"`)
      .send(e)
  })

  app.post(
    `${PREFISSO_API}/ripristino/verifica`,
    { bodyLimit: LIMITE_CORPO_RIPRISTINO },
    async (req) =>
      verificaRipristino(valida(SchemaRichiestaVerifica, req.body), {
        registro: ctx.ripristini,
        cartellaBackup: config.cartellaBackup,
      }),
  )

  app.post(`${PREFISSO_API}/ripristino/esegui`, async (req) => {
    const { token } = valida(SchemaEseguiRipristino, req.body)
    ctx.stato.manutenzione = true
    try {
      const esito = await eseguiRipristino(db, token, { registro: ctx.ripristini, cartellaBackup: config.cartellaBackup })
      return { ok: true as const, ...esito }
    } finally {
      ctx.stato.manutenzione = false
    }
  })
}
