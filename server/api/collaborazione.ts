// Rotte della collaborazione sulle ricette (SPEC §41). Ogni rotta controlla i permessi prima di
// validare il corpo: chi non vede la risorsa riceve 404, chi la vede ma non può agire 403.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  SchemaChiarimento,
  SchemaDecisioneTrasferimento,
  SchemaDecisioni,
  SchemaNuovaProposta,
  SchemaNuovoTrasferimento,
  SchemaQueryFotoProposta,
  SchemaRiassegnazione,
  SchemaRipristina,
} from '../../src/contratto/collaborazione.ts'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import * as collab from '../servizi/collaborazione.ts'
import { richiediAmministratoreRicetta, richiediPiatto, richiediProponente, richiediProposta, richiediTrasferimento } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaVersione = z.object({ versione: z.number().int().min(0) })

export function rotteCollaborazione(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  app.get<ConId>(`${P}/piatti/:id/collaborazione`, async (req) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'lettura')
    return collab.collaborazione(db, u, req.params.id)
  })

  // ── Proposte ──
  app.get<ConId>(`${P}/piatti/:id/proposte`, async (req) => collab.elencaProposte(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/piatti/:id/proposte`, async (req, reply) => {
    const u = chi(req)
    richiediProponente(db, u, req.params.id)
    return reply.code(201).send(collab.creaProposta(db, u, req.params.id, valida(SchemaNuovaProposta, req.body)))
  })
  app.get<ConId>(`${P}/proposte/:id`, async (req) => collab.leggiProposta(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/proposte/:id/foto`, async (req, reply) => {
    const u = chi(req)
    richiediProposta(db, u, req.params.id, 'autore')
    const q = valida(SchemaQueryFotoProposta, req.query)
    if (!(req.body instanceof Uint8Array)) return reply.code(415).send({ errore: { codice: 'tipo_non_supportato', messaggio: 'Invia il file dell\'immagine' } })
    return reply.code(201).send(await collab.aggiungiFotoProposta(db, ctx.foto, u, req.params.id, { id: q.id, dati: req.body, didascalia: q.didascalia, passo: q.passo ?? null }))
  })
  app.post<ConId>(`${P}/proposte/:id/decisione`, async (req) => {
    const u = chi(req)
    richiediProposta(db, u, req.params.id, 'decisione')
    return collab.decidi(db, ctx.foto, u, req.params.id, valida(SchemaDecisioni, req.body))
  })
  app.post<ConId>(`${P}/proposte/:id/ritira`, async (req) => {
    const u = chi(req)
    richiediProposta(db, u, req.params.id, 'autore')
    return collab.ritira(db, ctx.foto, u, req.params.id, valida(SchemaVersione, req.body).versione)
  })
  app.post<ConId>(`${P}/proposte/:id/chiarimenti`, async (req) => {
    const u = chi(req)
    richiediProposta(db, u, req.params.id, 'lettura')
    return collab.chiarimento(db, u, req.params.id, valida(SchemaChiarimento, req.body).testo)
  })

  // ── Cronologia ──
  app.get<ConId>(`${P}/piatti/:id/cronologia`, async (req) => collab.cronologia(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/piatti/:id/ripristina`, async (req) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'proprietario')
    const d = valida(SchemaRipristina, req.body)
    return collab.ripristina(db, u, req.params.id, d.revisioneId, d.versione)
  })

  // ── Proprietà ──
  app.post<ConId>(`${P}/piatti/:id/trasferimento`, async (req, reply) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'proprietario')
    return reply.code(201).send(collab.proponiTrasferimento(db, u, req.params.id, valida(SchemaNuovoTrasferimento, req.body)))
  })
  app.get<ConId>(`${P}/piatti/:id/riassegnazione`, async (req) => {
    const u = chi(req)
    richiediAmministratoreRicetta(db, u, req.params.id)
    return collab.destinatariRiassegnazione(db, u, req.params.id)
  })
  app.post<ConId>(`${P}/piatti/:id/riassegnazione`, async (req, reply) => {
    const u = chi(req)
    richiediAmministratoreRicetta(db, u, req.params.id)
    return reply.code(201).send(await collab.riassegna(db, ctx.foto, u, req.params.id, valida(SchemaRiassegnazione, req.body)))
  })
  app.post<ConId>(`${P}/trasferimenti/:id/decisione`, async (req) => {
    const u = chi(req)
    richiediTrasferimento(db, u, req.params.id)
    return collab.decidiTrasferimento(db, ctx.foto, u, req.params.id, valida(SchemaDecisioneTrasferimento, req.body))
  })
}
