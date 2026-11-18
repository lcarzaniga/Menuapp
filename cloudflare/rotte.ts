// Rotte proprie di Cloudflare (SPEC §32.6): backup in R2 ed esportazione, per l'amministratore.
// Il ripristino non ha rotte nell'app: passa dalla console (script amministrativo).
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { strToU8, zipSync } from 'fflate'
import { PREFISSO_API } from '../src/contratto/comune.ts'
import type { TipoFoto } from '../src/contratto/foto.ts'
import { chi, type Contesto } from '../server/api/aiuti.ts'
import { esporta, nomeFileEsportazione } from '../server/backup/esportazione.ts'
import { scriviMeta } from '../server/db/repo/meta.ts'
import { nonTrovato, richiestaNonValida } from '../server/servizi/errori.ts'
import { nomeFile } from '../server/servizi/foto.ts'
import { richiediSistema } from '../server/servizi/permessi.ts'
import { creaBackupR2, PREFISSO_BACKUP, RE_NOME_BACKUP_R2, statoBackupR2 } from './backup.ts'

export function rotteCloudflare(app: FastifyInstance, ctx: Contesto, bucket: R2Bucket): void {
  const { db } = ctx
  const sistema = (req: FastifyRequest) => richiediSistema(chi(req))

  app.get(`${PREFISSO_API}/backup`, async (req) => {
    sistema(req)
    return statoBackupR2(db, bucket)
  })

  app.post(`${PREFISSO_API}/backup`, async (req, reply) => {
    sistema(req)
    return reply.code(201).send(await creaBackupR2(db, bucket, 'manuale', ctx.versioneApp))
  })

  app.get<{ Params: { nome: string } }>(`${PREFISSO_API}/backup/:nome`, async (req, reply) => {
    sistema(req)
    if (!RE_NOME_BACKUP_R2.test(req.params.nome)) throw richiestaNonValida('Nome di backup non valido')
    const o = await bucket.get(`${PREFISSO_BACKUP}${req.params.nome}`)
    if (!o) throw nonTrovato('Backup')
    return reply
      .header('content-type', 'application/json')
      .header('content-disposition', `attachment; filename="menuapp-${req.params.nome}"`)
      .send(new Uint8Array(await o.arrayBuffer()))
  })

  app.get<{ Querystring: { foto?: string } }>(`${PREFISSO_API}/esportazione`, async (req, reply) => {
    sistema(req)
    const adesso = new Date()
    const e = esporta(db, ctx.versioneApp, adesso)
    scriviMeta(db, 'ultima_esportazione', adesso.toISOString())
    if (req.query.foto !== '1') {
      return reply.header('content-disposition', `attachment; filename="${nomeFileEsportazione(adesso)}"`).send(e)
    }
    // ZIP senza compressione (le immagini sono già compresse): esportazione.json + foto/<file>.
    const file: Record<string, Uint8Array> = { 'esportazione.json': strToU8(JSON.stringify(e)) }
    for (const r of (e.dati.foto_piatti ?? []) as { id: string; tipo: TipoFoto }[]) {
      const dati = await ctx.foto.leggi(nomeFile(r))
      if (dati) file[`foto/${nomeFile(r)}`] = dati
    }
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${nomeFileEsportazione(adesso).replace(/\.json$/, '.zip')}"`)
      .send(zipSync(file, { level: 0 }))
  })
}
