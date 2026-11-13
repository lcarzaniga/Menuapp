// Rotte di eventi, portate e voci di menù (SPEC §12.4). Ogni rotta verifica il permesso
// dell'utente sull'evento (o sull'evento della voce) prima di leggere o scrivere.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SchemaImpostaCondivisione, SchemaTrasferisci } from '../../src/contratto/accesso.ts'
import { PREFISSO_API, SchemaVersione } from '../../src/contratto/comune.ts'
import {
  SchemaAggiornaEvento,
  SchemaAggiornaVoce,
  SchemaNuoveVoci,
  SchemaNuovoEvento,
  SchemaRiordinoVoci,
} from '../../src/contratto/eventi.ts'
import { STATI_EVENTO } from '../../src/domain/tipi.ts'
import * as archivio from '../servizi/archivio.ts'
import * as condivisione from '../servizi/condivisione.ts'
import * as eventi from '../servizi/eventi.ts'
import { richiediEvento, richiediVoce, type UtenteCorrente } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaQueryStato = z.object({ stato: z.enum(STATI_EVENTO).optional() })

export function rotteEventi(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API
  const risolvi = (u: UtenteCorrente, eventoId: string) => (piattoId: string) =>
    condivisione.piattoPerEvento(db, ctx.config.cartellaFoto, u, eventoId, piattoId)

  app.get(`${P}/eventi`, async (req) => eventi.elencaEventi(db, chi(req).id, valida(SchemaQueryStato, req.query).stato))

  app.post(`${P}/eventi`, async (req, reply) => {
    const esito = eventi.creaEvento(db, valida(SchemaNuovoEvento, req.body), chi(req).id)
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })

  app.get<ConId>(`${P}/eventi/:id`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'lettura')
    return eventi.leggiEvento(db, req.params.id)
  })

  app.put<ConId>(`${P}/eventi/:id`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'modifica')
    return eventi.aggiornaEvento(db, req.params.id, valida(SchemaAggiornaEvento, req.body))
  })

  app.delete<ConId>(`${P}/eventi/:id`, async (req, reply) => {
    richiediEvento(db, chi(req), req.params.id, 'proprietario')
    eventi.eliminaEvento(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  app.post<ConId>(`${P}/eventi/:id/concludi`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'modifica')
    return eventi.cambiaStato(db, req.params.id, 'concludi', valida(SchemaVersione, req.body).versione)
  })
  app.post<ConId>(`${P}/eventi/:id/riapri`, async (req) => {
    // Riaprire un archiviato spetta al proprietario; un concluso a chi può modificare.
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'lettura')
    const archiviato = eventi.leggiEvento(db, req.params.id).stato === 'archiviato'
    richiediEvento(db, u, req.params.id, archiviato ? 'proprietario' : 'modifica')
    const { versione } = valida(SchemaVersione, req.body)
    return archiviato ? archivio.riapriArchiviato(db, req.params.id, versione) : eventi.cambiaStato(db, req.params.id, 'riapri', versione)
  })

  app.get<ConId>(`${P}/eventi/:id/menu`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'lettura')
    return eventi.leggiEvento(db, req.params.id).stato === 'archiviato' ? archivio.menuDaSnapshot(db, req.params.id) : eventi.leggiMenu(db, req.params.id)
  })

  app.post<ConId>(`${P}/eventi/:id/voci`, async (req, reply) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'modifica')
    const voci = eventi.creaVoci(db, req.params.id, valida(SchemaNuoveVoci, req.body).voci, risolvi(u, req.params.id))
    return reply.code(201).send(voci)
  })

  app.put<ConId>(`${P}/eventi/:id/voci/ordine`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'modifica')
    return eventi.riordinaVoci(db, req.params.id, valida(SchemaRiordinoVoci, req.body))
  })

  app.get<ConId>(`${P}/voci/:id`, async (req) => {
    richiediVoce(db, chi(req), req.params.id, 'lettura')
    return eventi.leggiVoce(db, req.params.id)
  })

  app.put<ConId>(`${P}/voci/:id`, async (req) => {
    const u = chi(req)
    const eventoId = richiediVoce(db, u, req.params.id, 'modifica')
    return eventi.aggiornaVoce(db, req.params.id, valida(SchemaAggiornaVoce, req.body), risolvi(u, eventoId))
  })

  app.delete<ConId>(`${P}/voci/:id`, async (req, reply) => {
    richiediVoce(db, chi(req), req.params.id, 'modifica')
    eventi.eliminaVoce(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  // ── Condivisione dell'evento ────────────────────────────────

  app.get<ConId>(`${P}/eventi/:id/accesso`, async (req) => condivisione.accessoEvento(db, chi(req), req.params.id))

  app.put<{ Params: { id: string; utenteId: string } }>(`${P}/eventi/:id/condivisioni/:utenteId`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'proprietario')
    return condivisione.condividiEvento(db, u, req.params.id, req.params.utenteId, valida(SchemaImpostaCondivisione, req.body).permesso)
  })

  app.delete<{ Params: { id: string; utenteId: string } }>(`${P}/eventi/:id/condivisioni/:utenteId`, async (req, reply) => {
    condivisione.revocaCondivisioneEvento(db, chi(req), req.params.id, req.params.utenteId)
    return reply.code(204).send()
  })

  app.post<ConId>(`${P}/eventi/:id/trasferisci`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'proprietario')
    const d = valida(SchemaTrasferisci, req.body)
    return condivisione.trasferisciEvento(db, ctx.config.cartellaFoto, u, req.params.id, d.utenteId, d.versione)
  })
}
