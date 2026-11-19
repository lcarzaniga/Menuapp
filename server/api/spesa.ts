// Rotte della spesa, dell'archivio e del piano (SPEC §12.4).
import { regia } from '../servizi/regia.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { SchemaAggiornaAttivita, SchemaCopiaPiatto, SchemaNuovaAttivita, SchemaSpostaAttivita } from '../../src/contratto/archivio.ts'
import { PREFISSO_API, SchemaVersione } from '../../src/contratto/comune.ts'
import { SchemaAggiornaManuale, SchemaAggiornaRiga, SchemaNuovoManuale, SchemaTrasferisci } from '../../src/contratto/spesa.ts'
import * as archivio from '../servizi/archivio.ts'
import * as attivita from '../servizi/attivita.ts'
import { leggiEvento } from '../servizi/eventi.ts'
import * as spesa from '../servizi/spesa.ts'
import { richiediArticolo, richiediAttivita, richiediEvento, richiediSnapshot } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
type ConChiave = { Params: { id: string; chiave: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })

export function rotteSpesa(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API
  // Rotte sotto /eventi/:id: permesso sull'evento del percorso.
  const leggi = (req: FastifyRequest<ConId>) => richiediEvento(db, chi(req), req.params.id, 'lettura')
  const modifica = (req: FastifyRequest<ConId>) => richiediEvento(db, chi(req), req.params.id, 'modifica')

  // ── Spesa ──
  app.get<ConId>(`${P}/eventi/:id/spesa`, async (req) => {
    leggi(req)
    return spesa.listaSpesa(db, req.params.id)
  })
  app.put<ConChiave>(`${P}/eventi/:id/spesa/righe/:chiave`, async (req) => {
    modifica(req)
    return spesa.aggiornaRiga(db, req.params.id, req.params.chiave, valida(SchemaAggiornaRiga, req.body))
  })
  app.delete<ConChiave>(`${P}/eventi/:id/spesa/righe/:chiave`, async (req, reply) => {
    modifica(req)
    spesa.eliminaRiga(db, req.params.id, req.params.chiave, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
  app.post<ConId>(`${P}/eventi/:id/spesa/ripulisci`, async (req) => {
    modifica(req)
    return spesa.ripulisci(db, req.params.id)
  })
  app.post<ConId>(`${P}/eventi/:id/spesa/trasferisci`, async (req) => {
    modifica(req)
    const d = valida(SchemaTrasferisci, req.body)
    return spesa.trasferisci(db, req.params.id, d.da, d.a, d.versione)
  })
  app.post<ConId>(`${P}/eventi/:id/spesa/manuali`, async (req, reply) => {
    modifica(req)
    const esito = spesa.creaManuale(db, req.params.id, valida(SchemaNuovoManuale, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.put<ConId>(`${P}/spesa/manuali/:id`, async (req) => {
    richiediArticolo(db, chi(req), req.params.id, 'modifica')
    return spesa.aggiornaManuale(db, req.params.id, valida(SchemaAggiornaManuale, req.body))
  })
  app.delete<ConId>(`${P}/spesa/manuali/:id`, async (req, reply) => {
    richiediArticolo(db, chi(req), req.params.id, 'modifica')
    spesa.eliminaManuale(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  // ── Archivio ──
  app.post<ConId>(`${P}/eventi/:id/archivia`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'proprietario')
    return archivio.archivia(db, req.params.id, valida(SchemaVersione, req.body).versione)
  })
  app.get<ConId>(`${P}/eventi/:id/riapertura`, async (req) => {
    leggi(req)
    return archivio.infoRiapertura(db, req.params.id)
  })
  app.get<ConId>(`${P}/eventi/:id/snapshot`, async (req) => {
    leggi(req)
    return archivio.elencaSnapshot(db, req.params.id)
  })
  app.get<ConId>(`${P}/snapshot/:id`, async (req) => {
    richiediSnapshot(db, chi(req), req.params.id)
    return archivio.leggiSnapshot(db, req.params.id)
  })
  app.post<ConId>(`${P}/snapshot/:id/copia-piatto`, async (req, reply) => {
    const u = chi(req)
    richiediSnapshot(db, u, req.params.id)
    const d = valida(SchemaCopiaPiatto, req.body)
    return reply.code(201).send(archivio.copiaPiattoDaSnapshot(db, req.params.id, d.piattoId, d.nuovoId, u.id))
  })

  // ── Piano ──
  // Regia della cucina (SPEC §38): piano, piatti, tempi e attrezzature in una sola lettura.
  app.get<ConId>(`${P}/eventi/:id/regia`, async (req) => regia(db, chi(req), req.params.id))
  app.get<ConId>(`${P}/eventi/:id/attivita`, async (req) => {
    leggi(req)
    return leggiEvento(db, req.params.id).stato === 'archiviato' ? archivio.attivitaDaSnapshot(db, req.params.id) : attivita.elencaAttivita(db, req.params.id)
  })
  app.post<ConId>(`${P}/eventi/:id/attivita`, async (req, reply) => {
    modifica(req)
    const esito = attivita.creaAttivita(db, req.params.id, valida(SchemaNuovaAttivita, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.post<ConId>(`${P}/eventi/:id/attivita/sposta`, async (req) => {
    modifica(req)
    return attivita.spostaAttivita(db, req.params.id, valida(SchemaSpostaAttivita, req.body).giorni)
  })
  app.put<ConId>(`${P}/attivita/:id`, async (req) => {
    richiediAttivita(db, chi(req), req.params.id, 'modifica')
    return attivita.aggiornaAttivita(db, req.params.id, valida(SchemaAggiornaAttivita, req.body))
  })
  app.delete<ConId>(`${P}/attivita/:id`, async (req, reply) => {
    richiediAttivita(db, chi(req), req.params.id, 'modifica')
    attivita.eliminaAttivita(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
}
