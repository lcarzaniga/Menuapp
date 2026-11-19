// Rotte della memoria di famiglia (SPEC §40). Le autorizzazioni sono nel servizio e in permessi.ts.
import type { FastifyInstance } from 'fastify'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaQueryCaricaFoto } from '../../src/contratto/foto.ts'
import { SchemaAggiornaMemoria, SchemaNuovaMemoria, SchemaStoria } from '../../src/contratto/memoria.ts'
import * as memoria from '../servizi/memoria.ts'
import { richiediContributoMemoria, richiediMemoria, richiediPiatto } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'
import { z } from 'zod'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })

export function rotteMemoria(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API
  app.get<ConId>(`${P}/piatti/:id/memoria`, async (req) => memoria.memoriaRicetta(db, chi(req), req.params.id))
  // Prima i permessi, poi la validazione del corpo: chi non vede la risorsa riceve sempre 404.
  app.put<ConId>(`${P}/piatti/:id/storia`, async (req) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'proprietario')
    return memoria.scriviStoria(db, u, req.params.id, valida(SchemaStoria, req.body))
  })
  app.post<ConId>(`${P}/piatti/:id/memorie`, async (req, reply) => {
    const u = chi(req)
    richiediContributoMemoria(db, u, req.params.id)
    return reply.code(201).send(memoria.aggiungiMemoria(db, u, req.params.id, valida(SchemaNuovaMemoria, req.body)))
  })
  app.put<ConId>(`${P}/memorie/:id`, async (req) => {
    const u = chi(req)
    richiediMemoria(db, u, req.params.id, 'modifica')
    return memoria.aggiornaMemoria(db, u, req.params.id, valida(SchemaAggiornaMemoria, req.body))
  })
  app.delete<ConId>(`${P}/memorie/:id`, async (req, reply) => {
    const u = chi(req)
    richiediMemoria(db, u, req.params.id, 'elimina')
    await memoria.eliminaMemoria(db, ctx.foto, u, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
  app.post<ConId>(`${P}/memorie/:id/foto`, async (req, reply) => {
    richiediMemoria(db, chi(req), req.params.id, 'modifica')
    const q = valida(SchemaQueryCaricaFoto, req.query)
    if (!(req.body instanceof Uint8Array)) return reply.code(415).send({ errore: { codice: 'tipo_non_supportato', messaggio: 'Invia il file dell\'immagine' } })
    return reply.code(201).send(await memoria.aggiungiFotoMemoria(db, ctx.foto, chi(req), req.params.id, { id: q.id, dati: req.body, didascalia: q.didascalia }))
  })
}
