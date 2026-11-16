// Rotte dei partecipanti e dei coperti (SPEC §24). L'accesso alla risorsa si verifica prima
// di validare il corpo.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaAccompagnatori, SchemaAggiornaPartecipante, SchemaCoperti, SchemaNuovoPartecipante } from '../../src/contratto/partecipanti.ts'
import * as partecipanti from '../servizi/partecipanti.ts'
import { richiediEvento } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaVersione = z.object({ versione: z.number().int().min(0) })

export function rottePartecipanti(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  app.get<ConId>(`${P}/eventi/:id/partecipanti`, async (req) => partecipanti.elenca(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/eventi/:id/partecipanti`, async (req, reply) => {
    const u = chi(req)
    partecipanti.richiediAggiunta(db, u, req.params.id)
    return reply.code(201).send(partecipanti.crea(db, u, req.params.id, valida(SchemaNuovoPartecipante, req.body)))
  })
  app.put<ConId>(`${P}/eventi/:id/coperti`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'modifica')
    return partecipanti.impostaCoperti(db, u, req.params.id, valida(SchemaCoperti, req.body))
  })
  app.put<ConId>(`${P}/partecipanti/:id`, async (req) => {
    const u = chi(req)
    partecipanti.richiedi(db, u, req.params.id)
    return partecipanti.aggiorna(db, u, req.params.id, valida(SchemaAggiornaPartecipante, req.body))
  })
  app.put<ConId>(`${P}/partecipanti/:id/accompagnatori`, async (req) => {
    const u = chi(req)
    partecipanti.richiedi(db, u, req.params.id)
    const d = valida(SchemaAccompagnatori, req.body)
    return partecipanti.impostaAnonimi(db, u, req.params.id, d.anonimi, d.versione)
  })
  app.post<ConId>(`${P}/partecipanti/:id/autonomo`, async (req) => {
    const u = chi(req)
    partecipanti.richiedi(db, u, req.params.id)
    return partecipanti.rendiAutonomo(db, u, req.params.id, valida(SchemaVersione, req.body).versione)
  })
  app.delete<ConId>(`${P}/partecipanti/:id`, async (req, reply) => {
    const u = chi(req)
    partecipanti.richiedi(db, u, req.params.id)
    partecipanti.elimina(db, u, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
}
