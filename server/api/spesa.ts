// Rotte della spesa, dell'archivio e del piano (SPEC §12.4).
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SchemaAggiornaAttivita, SchemaCopiaPiatto, SchemaNuovaAttivita, SchemaSpostaAttivita } from '../../src/contratto/archivio.ts'
import { PREFISSO_API, SchemaVersione } from '../../src/contratto/comune.ts'
import { SchemaAggiornaManuale, SchemaAggiornaRiga, SchemaNuovoManuale, SchemaTrasferisci } from '../../src/contratto/spesa.ts'
import * as archivio from '../servizi/archivio.ts'
import * as attivita from '../servizi/attivita.ts'
import { leggiEvento } from '../servizi/eventi.ts'
import * as spesa from '../servizi/spesa.ts'
import { type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
type ConChiave = { Params: { id: string; chiave: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })

export function rotteSpesa(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  // ── Spesa ──
  app.get<ConId>(`${P}/eventi/:id/spesa`, async (req) => spesa.listaSpesa(db, req.params.id))
  app.put<ConChiave>(`${P}/eventi/:id/spesa/righe/:chiave`, async (req) =>
    spesa.aggiornaRiga(db, req.params.id, req.params.chiave, valida(SchemaAggiornaRiga, req.body)),
  )
  app.delete<ConChiave>(`${P}/eventi/:id/spesa/righe/:chiave`, async (req, reply) => {
    spesa.eliminaRiga(db, req.params.id, req.params.chiave, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
  app.post<ConId>(`${P}/eventi/:id/spesa/ripulisci`, async (req) => spesa.ripulisci(db, req.params.id))
  app.post<ConId>(`${P}/eventi/:id/spesa/trasferisci`, async (req) => {
    const d = valida(SchemaTrasferisci, req.body)
    return spesa.trasferisci(db, req.params.id, d.da, d.a, d.versione)
  })
  app.post<ConId>(`${P}/eventi/:id/spesa/manuali`, async (req, reply) => {
    const esito = spesa.creaManuale(db, req.params.id, valida(SchemaNuovoManuale, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.put<ConId>(`${P}/spesa/manuali/:id`, async (req) => spesa.aggiornaManuale(db, req.params.id, valida(SchemaAggiornaManuale, req.body)))
  app.delete<ConId>(`${P}/spesa/manuali/:id`, async (req, reply) => {
    spesa.eliminaManuale(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  // ── Archivio ──
  app.post<ConId>(`${P}/eventi/:id/archivia`, async (req) => archivio.archivia(db, req.params.id, valida(SchemaVersione, req.body).versione))
  app.get<ConId>(`${P}/eventi/:id/riapertura`, async (req) => archivio.infoRiapertura(db, req.params.id))
  app.get<ConId>(`${P}/eventi/:id/snapshot`, async (req) => archivio.elencaSnapshot(db, req.params.id))
  app.get<ConId>(`${P}/snapshot/:id`, async (req) => archivio.leggiSnapshot(db, req.params.id))
  app.post<ConId>(`${P}/snapshot/:id/copia-piatto`, async (req, reply) => {
    const d = valida(SchemaCopiaPiatto, req.body)
    return reply.code(201).send(archivio.copiaPiattoDaSnapshot(db, req.params.id, d.piattoId, d.nuovoId))
  })

  // ── Piano ──
  app.get<ConId>(`${P}/eventi/:id/attivita`, async (req) =>
    leggiEvento(db, req.params.id).stato === 'archiviato' ? archivio.attivitaDaSnapshot(db, req.params.id) : attivita.elencaAttivita(db, req.params.id),
  )
  app.post<ConId>(`${P}/eventi/:id/attivita`, async (req, reply) => {
    const esito = attivita.creaAttivita(db, req.params.id, valida(SchemaNuovaAttivita, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.post<ConId>(`${P}/eventi/:id/attivita/sposta`, async (req) =>
    attivita.spostaAttivita(db, req.params.id, valida(SchemaSpostaAttivita, req.body).giorni),
  )
  app.put<ConId>(`${P}/attivita/:id`, async (req) => attivita.aggiornaAttivita(db, req.params.id, valida(SchemaAggiornaAttivita, req.body)))
  app.delete<ConId>(`${P}/attivita/:id`, async (req, reply) => {
    attivita.eliminaAttivita(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
}
