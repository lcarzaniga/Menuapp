// Rotte di duplicazione, edizioni, riepilogo e confronto degli eventi (SPEC §25–§27).
// L'accesso all'evento si verifica prima di validare il corpo.
import type { FastifyInstance } from 'fastify'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaDuplica, SchemaSerie } from '../../src/contratto/edizioni.ts'
import { z } from 'zod'
import { confronta } from '../servizi/confronto.ts'
import * as duplicazione from '../servizi/duplicazione.ts'
import { riepilogo } from '../servizi/riepilogo.ts'
import { richiediEvento } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }

export function rotteEdizioni(app: FastifyInstance, ctx: Contesto): void {
  const { db, config } = ctx
  const P = PREFISSO_API

  app.post<ConId>(`${P}/eventi/:id/duplica`, async (req, reply) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'lettura')
    return reply.code(201).send(duplicazione.duplica(db, config.cartellaFoto, u, req.params.id, valida(SchemaDuplica, req.body)))
  })
  app.get<ConId>(`${P}/eventi/:id/confronto`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'lettura')
    return confronta(db, u, req.params.id, valida(z.object({ con: z.string().min(1).max(100) }), req.query).con)
  })
  app.get<ConId>(`${P}/eventi/:id/riepilogo`, async (req) => riepilogo(db, chi(req), req.params.id))
  app.get<ConId>(`${P}/eventi/:id/edizioni`, async (req) => duplicazione.edizioni(db, chi(req), req.params.id))
  app.put<ConId>(`${P}/eventi/:id/serie`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'modifica')
    return duplicazione.collegaSerie(db, u, req.params.id, valida(SchemaSerie, req.body).conEventoId)
  })
}
