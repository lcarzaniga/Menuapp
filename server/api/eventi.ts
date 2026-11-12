// Rotte di eventi, portate e voci di menù (SPEC §12.4).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PREFISSO_API, SchemaVersione } from '../../src/contratto/comune.ts'
import {
  SchemaAggiornaEvento,
  SchemaAggiornaVoce,
  SchemaNuoveVoci,
  SchemaNuovoEvento,
  SchemaRiordinoVoci,
} from '../../src/contratto/eventi.ts'
import { STATI_EVENTO } from '../../src/domain/tipi.ts'
import * as eventi from '../servizi/eventi.ts'
import { type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaQueryStato = z.object({ stato: z.enum(STATI_EVENTO).optional() })

export function rotteEventi(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  app.get(`${P}/eventi`, async (req) => eventi.elencaEventi(db, valida(SchemaQueryStato, req.query).stato))

  app.post(`${P}/eventi`, async (req, reply) => {
    const esito = eventi.creaEvento(db, valida(SchemaNuovoEvento, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })

  app.get<ConId>(`${P}/eventi/:id`, async (req) => eventi.leggiEvento(db, req.params.id))

  app.put<ConId>(`${P}/eventi/:id`, async (req) => eventi.aggiornaEvento(db, req.params.id, valida(SchemaAggiornaEvento, req.body)))

  app.delete<ConId>(`${P}/eventi/:id`, async (req, reply) => {
    eventi.eliminaEvento(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  app.post<ConId>(`${P}/eventi/:id/concludi`, async (req) =>
    eventi.cambiaStato(db, req.params.id, 'concludi', valida(SchemaVersione, req.body).versione),
  )
  app.post<ConId>(`${P}/eventi/:id/riapri`, async (req) =>
    eventi.cambiaStato(db, req.params.id, 'riapri', valida(SchemaVersione, req.body).versione),
  )

  app.get<ConId>(`${P}/eventi/:id/menu`, async (req) => eventi.leggiMenu(db, req.params.id))

  app.post<ConId>(`${P}/eventi/:id/voci`, async (req, reply) => {
    const voci = eventi.creaVoci(db, req.params.id, valida(SchemaNuoveVoci, req.body).voci)
    return reply.code(201).send(voci)
  })

  app.put<ConId>(`${P}/eventi/:id/voci/ordine`, async (req) =>
    eventi.riordinaVoci(db, req.params.id, valida(SchemaRiordinoVoci, req.body)),
  )

  app.get<ConId>(`${P}/voci/:id`, async (req) => eventi.leggiVoce(db, req.params.id))

  app.put<ConId>(`${P}/voci/:id`, async (req) => eventi.aggiornaVoce(db, req.params.id, valida(SchemaAggiornaVoce, req.body)))

  app.delete<ConId>(`${P}/voci/:id`, async (req, reply) => {
    eventi.eliminaVoce(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
}
