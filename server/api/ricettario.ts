// Rotte di piatti, catalogo ingredienti e reparti (SPEC §12.4).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PREFISSO_API, SchemaRiordino } from '../../src/contratto/comune.ts'
import { SchemaAggiornaReparto, SchemaNuovoReparto } from '../../src/contratto/impostazioni.ts'
import {
  SchemaAggiornaIngrediente,
  SchemaAggiornaPiatto,
  SchemaCreaPiattoDaVoce,
  SchemaNuovoIngrediente,
  SchemaNuovoPiatto,
} from '../../src/contratto/ricettario.ts'
import * as r from '../servizi/ricettario.ts'
import { type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaRicerca = z.object({ q: z.string().max(200).optional() })

export function rotteRicettario(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  app.get(`${P}/piatti`, async (req) => r.elencaPiatti(db, valida(SchemaRicerca, req.query).q))
  app.post(`${P}/piatti`, async (req, reply) => {
    const esito = r.creaPiatto(db, valida(SchemaNuovoPiatto, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.get<ConId>(`${P}/piatti/:id`, async (req) => r.leggiPiatto(db, req.params.id))
  app.put<ConId>(`${P}/piatti/:id`, async (req) => r.aggiornaPiatto(db, req.params.id, valida(SchemaAggiornaPiatto, req.body)))
  app.delete<ConId>(`${P}/piatti/:id`, async (req, reply) => {
    r.eliminaPiatto(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
  app.post<ConId>(`${P}/voci/:id/crea-piatto`, async (req, reply) => {
    const d = valida(SchemaCreaPiattoDaVoce, req.body)
    return reply.code(201).send(r.creaPiattoDaVoce(db, req.params.id, d.piattoId, d.versione))
  })

  app.get(`${P}/ingredienti`, async () => r.elencaIngredienti(db))
  app.post(`${P}/ingredienti`, async (req, reply) => {
    const esito = r.creaIngrediente(db, valida(SchemaNuovoIngrediente, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.get<ConId>(`${P}/ingredienti/:id`, async (req) => r.leggiIngrediente(db, req.params.id))
  app.get<ConId>(`${P}/ingredienti/:id/usi`, async (req) => r.usiIngrediente(db, req.params.id))
  app.put<ConId>(`${P}/ingredienti/:id`, async (req) => r.aggiornaIngrediente(db, req.params.id, valida(SchemaAggiornaIngrediente, req.body)))
  app.delete<ConId>(`${P}/ingredienti/:id`, async (req, reply) => {
    r.eliminaIngrediente(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  app.post(`${P}/reparti`, async (req, reply) => {
    const d = valida(SchemaNuovoReparto, req.body)
    return reply.code(201).send(r.creaReparto(db, d.id, d.nome))
  })
  app.put(`${P}/reparti/ordine`, async (req) => r.riordinaReparti(db, valida(SchemaRiordino, req.body).voci))
  app.put<ConId>(`${P}/reparti/:id`, async (req) => {
    const d = valida(SchemaAggiornaReparto, req.body)
    return r.rinominaReparto(db, req.params.id, d.nome, d.versione)
  })
  app.delete<ConId>(`${P}/reparti/:id`, async (req, reply) => {
    r.eliminaReparto(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
}
