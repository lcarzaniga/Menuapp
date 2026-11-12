// Rotte delle foto e dell'esportazione della ricetta (formato v1).
import type { FastifyInstance } from 'fastify'
import { strToU8, zipSync } from 'fflate'
import { z } from 'zod'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaAggiornaFoto, SchemaQueryCaricaFoto } from '../../src/contratto/foto.ts'
import { daPiatto, nomeFileRicetta } from '../../src/domain/ricetta/formato.ts'
import * as foto from '../servizi/foto.ts'
import { leggiPiatto } from '../servizi/ricettario.ts'
import { type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })

export function rotteFoto(app: FastifyInstance, ctx: Contesto): void {
  const { db, config } = ctx
  const P = PREFISSO_API

  app.post<ConId>(`${P}/piatti/:id/foto`, async (req, reply) => {
    const q = valida(SchemaQueryCaricaFoto, req.query)
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ errore: { codice: 'tipo_non_supportato', messaggio: 'Invia il file dell\'immagine' } })
    const f = await foto.caricaFoto(db, config.cartellaFoto, req.params.id, { id: q.id, dati: req.body, didascalia: q.didascalia, principale: q.principale === '1', passo: q.passo ?? null })
    return reply.code(201).send(f)
  })

  app.get<ConId>(`${P}/foto/:id`, async (req, reply) => {
    const f = foto.leggiFoto(db, req.params.id)
    const dati = await foto.leggiFile(config.cartellaFoto, f)
    // id unico e contenuto immutabile: il browser può tenerla in cache a lungo.
    return reply.header('content-type', f.tipo).header('cache-control', 'private, max-age=31536000, immutable').send(dati)
  })

  app.put<ConId>(`${P}/foto/:id`, async (req) => foto.aggiornaFoto(db, req.params.id, valida(SchemaAggiornaFoto, req.body)))

  app.delete<ConId>(`${P}/foto/:id`, async (req, reply) => {
    await foto.eliminaFoto(db, config.cartellaFoto, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  /** Rimette il file di una foto registrata ma mancante (ripristino da esportazione ZIP). */
  app.put<ConId>(`${P}/foto/:id/file`, async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ errore: { codice: 'tipo_non_supportato', messaggio: 'Invia il file dell\'immagine' } })
    await foto.rimettiFile(db, config.cartellaFoto, req.params.id, req.body)
    return reply.code(204).send()
  })

  app.get<ConId>(`${P}/piatti/:id/esporta`, async (req, reply) => {
    const p = leggiPiatto(db, req.params.id)
    const elenco = foto.elencaFoto(db, p.id)
    const file: Record<string, Uint8Array> = {}
    const voci = []
    for (const [k, f] of elenco.entries()) {
      const nome = `foto/${k + 1}.${foto.ESTENSIONI[f.tipo]}`
      file[nome] = await foto.leggiFile(config.cartellaFoto, f)
      voci.push({ file: nome, didascalia: f.didascalia, principale: f.principale, ...(f.passo === null ? {} : { passo: f.passo + 1 }) })
    }
    file['ricetta.json'] = strToU8(JSON.stringify(daPiatto(p, voci), null, 2))
    const zip = zipSync(file, { level: 0 })
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${nomeFileRicetta(p.nome)}"`)
      .send(Buffer.from(zip))
  })
}
