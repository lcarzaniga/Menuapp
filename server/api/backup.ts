// Rotte di backup, esportazione e ripristino (SPEC §11).
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import type { TipoFoto } from '../../src/contratto/foto.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { SchemaEseguiRipristino, SchemaRichiestaVerifica } from '../../src/contratto/backup.ts'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { percorsoBackup, RE_NOME_BACKUP } from '../backup/backup.ts'
import { esporta, nomeFileEsportazione } from '../backup/esportazione.ts'
import { eseguiRipristino, verificaRipristino } from '../backup/ripristino.ts'
import { LIMITE_CORPO_RIPRISTINO } from '../app.ts'
import { eseguiBackup, registraEsportazione, statoBackup } from '../servizi/backup.ts'
import { nomeFile, recuperaFotoMancanti, sincronizzaFotoNelBackup } from '../servizi/foto.ts'
import { nonTrovato, richiestaNonValida } from '../servizi/errori.ts'
import { richiediSistema } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

export function rotteBackup(app: FastifyInstance, ctx: Contesto): void {
  const { db, config } = ctx

  // Funzioni di sistema: amministratore dall'ingresso privato (l'ingresso pubblico non le
  // raggiunge nemmeno, vedi RE_SISTEMA). Il controllo qui è la seconda difesa.
  const sistema = (req: FastifyRequest) => richiediSistema(chi(req))

  app.get(`${PREFISSO_API}/backup`, async (req) => {
    sistema(req)
    return statoBackup(db, config.cartellaBackup)
  })

  app.post(`${PREFISSO_API}/backup`, async (req, reply) => {
    sistema(req)
    const info = await eseguiBackup(db, config.cartellaBackup, 'manuale', config.cartellaFoto)
    return reply.code(201).send(info)
  })

  app.get<{ Params: { nome: string } }>(`${PREFISSO_API}/backup/:nome`, async (req, reply) => {
    sistema(req)
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

  app.get<{ Querystring: { foto?: string } }>(`${PREFISSO_API}/esportazione`, async (req, reply) => {
    sistema(req)
    const adesso = new Date()
    const e = esporta(db, ctx.versioneApp, adesso)
    registraEsportazione(db, adesso)
    if (req.query.foto !== '1') {
      return reply.header('content-disposition', `attachment; filename="${nomeFileEsportazione(adesso)}"`).send(e)
    }
    // ZIP: esportazione.json + foto/<file>, per conservare anche le immagini fuori dal server.
    const file: Record<string, Uint8Array> = { 'esportazione.json': strToU8(JSON.stringify(e)) }
    for (const r of (e.dati.foto_piatti ?? []) as { id: string; tipo: TipoFoto }[]) {
      try {
        file[`foto/${nomeFile(r)}`] = await readFile(join(config.cartellaFoto, nomeFile(r)))
      } catch {
        // file mancante: la riga resta nell'esportazione, il ripristino lo segnalerà
      }
    }
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${nomeFileEsportazione(adesso).replace(/\.json$/, '.zip')}"`)
      .send(Buffer.from(zipSync(file, { level: 0 })))
  })

  app.post(
    `${PREFISSO_API}/ripristino/verifica`,
    { bodyLimit: LIMITE_CORPO_RIPRISTINO },
    async (req) =>
      sistema(req) ??
      verificaRipristino(valida(SchemaRichiestaVerifica, req.body), {
        registro: ctx.ripristini,
        cartellaBackup: config.cartellaBackup,
      }),
  )

  app.post(`${PREFISSO_API}/ripristino/esegui`, async (req) => {
    sistema(req)
    const { token } = valida(SchemaEseguiRipristino, req.body)
    ctx.stato.manutenzione = true
    try {
      await sincronizzaFotoNelBackup(config.cartellaFoto, config.cartellaBackup)
      const esito = await eseguiRipristino(db, token, { registro: ctx.ripristini, cartellaBackup: config.cartellaBackup })
      const fotoMancanti = await recuperaFotoMancanti(db, config.cartellaFoto, config.cartellaBackup)
      return { ok: true as const, ...esito, fotoMancanti }
    } finally {
      ctx.stato.manutenzione = false
    }
  })
}
