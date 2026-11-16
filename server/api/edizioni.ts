// Rotte di duplicazione, edizioni, riepilogo e confronto degli eventi (SPEC §25–§27).
// L'accesso all'evento si verifica prima di validare il corpo.
import type { FastifyInstance } from 'fastify'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaAggiornaRicorrenza, SchemaAssociaRicorrenza, SchemaDuplica, SchemaNuovaRicorrenza } from '../../src/contratto/edizioni.ts'
import { z } from 'zod'
import { confronta } from '../servizi/confronto.ts'
import * as duplicazione from '../servizi/duplicazione.ts'
import { riepilogo } from '../servizi/riepilogo.ts'
import * as ricorrenze from '../servizi/ricorrenze.ts'
import { richiediEvento, richiediGruppo } from '../servizi/permessi.ts'
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
  app.put<ConId>(`${P}/eventi/:id/ricorrenza`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'modifica')
    return duplicazione.associaRicorrenza(db, u, req.params.id, valida(SchemaAssociaRicorrenza, req.body).ricorrenzaId)
  })

  // ── Ricorrenze della Famiglia ──
  app.get<ConId>(`${P}/famiglie/:id/ricorrenze`, async (req) => ricorrenze.elenca(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/famiglie/:id/ricorrenze`, async (req, reply) => {
    const u = chi(req)
    richiediGruppo(db, u, req.params.id)
    return reply.code(201).send(ricorrenze.crea(db, u, req.params.id, valida(SchemaNuovaRicorrenza, req.body)))
  })
  app.put<ConId>(`${P}/ricorrenze/:id`, async (req) => {
    const u = chi(req)
    ricorrenze.richiedi(db, u, req.params.id)
    return ricorrenze.aggiorna(db, u, req.params.id, valida(SchemaAggiornaRicorrenza, req.body))
  })
  app.delete<ConId>(`${P}/ricorrenze/:id`, async (req, reply) => {
    ricorrenze.elimina(db, chi(req), req.params.id)
    return reply.code(204).send()
  })
}
