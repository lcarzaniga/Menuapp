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
import { SchemaCopiaPiatto } from '../../src/contratto/accesso.ts'
import * as condivisione from '../servizi/condivisione.ts'
import { richiediAmministratore, richiediPiatto, richiediVoce } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

const SchemaImpostaCondivisioniPiatto = z.object({ utenti: z.array(z.string().min(1).max(100)).max(50) })

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaRicerca = z.object({ q: z.string().max(200).optional() })

export function rotteRicettario(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  // Ricettario: piatti propri e condivisi; modifica solo del proprietario.
  app.get(`${P}/piatti`, async (req) => r.elencaPiatti(db, chi(req).id, valida(SchemaRicerca, req.query).q))
  app.post(`${P}/piatti`, async (req, reply) => {
    const esito = r.creaPiatto(db, valida(SchemaNuovoPiatto, req.body), { proprietarioId: chi(req).id })
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.get<ConId>(`${P}/piatti/:id`, async (req) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'lettura')
    return r.leggiPiatto(db, req.params.id, u.id)
  })
  app.put<ConId>(`${P}/piatti/:id`, async (req) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'proprietario')
    return r.aggiornaPiatto(db, req.params.id, valida(SchemaAggiornaPiatto, req.body), u.id)
  })
  app.delete<ConId>(`${P}/piatti/:id`, async (req, reply) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'proprietario')
    r.eliminaPiatto(db, req.params.id, valida(SchemaQueryVersione, req.query).versione, u.id)
    return reply.code(204).send()
  })
  app.post<ConId>(`${P}/voci/:id/crea-piatto`, async (req, reply) => {
    richiediVoce(db, chi(req), req.params.id, 'modifica')
    const d = valida(SchemaCreaPiattoDaVoce, req.body)
    return reply.code(201).send(r.creaPiattoDaVoce(db, req.params.id, d.piattoId, d.versione))
  })

  // Condivisione delle ricette (in sola lettura) e copia nel proprio ricettario.
  app.get<ConId>(`${P}/piatti/:id/condivisioni`, async (req) => condivisione.condivisioniPiatto(db, chi(req), req.params.id))
  app.put<ConId>(`${P}/piatti/:id/condivisioni`, async (req) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'proprietario')
    return condivisione.impostaCondivisioniPiatto(db, u, req.params.id, valida(SchemaImpostaCondivisioniPiatto, req.body).utenti)
  })
  app.post<ConId>(`${P}/piatti/:id/copia`, async (req, reply) => {
    const u = chi(req)
    richiediPiatto(db, u, req.params.id, 'lettura')
    const id = condivisione.copiaPiatto(db, ctx.config.cartellaFoto, u, req.params.id, valida(SchemaCopiaPiatto, req.body).id)
    return reply.code(201).send(r.leggiPiatto(db, id, u.id))
  })

  // Catalogo condiviso: tutti lo leggono e lo arricchiscono; eliminazioni e reparti solo
  // all'amministratore.
  app.get(`${P}/ingredienti`, async (req) => {
    chi(req)
    return r.elencaIngredienti(db)
  })
  app.post(`${P}/ingredienti`, async (req, reply) => {
    chi(req)
    const esito = r.creaIngrediente(db, valida(SchemaNuovoIngrediente, req.body))
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })
  app.get<ConId>(`${P}/ingredienti/:id`, async (req) => {
    chi(req)
    return r.leggiIngrediente(db, req.params.id)
  })
  app.get<ConId>(`${P}/ingredienti/:id/usi`, async (req) => r.usiIngrediente(db, req.params.id, chi(req).id))
  app.put<ConId>(`${P}/ingredienti/:id`, async (req) => {
    chi(req)
    return r.aggiornaIngrediente(db, req.params.id, valida(SchemaAggiornaIngrediente, req.body))
  })
  app.delete<ConId>(`${P}/ingredienti/:id`, async (req, reply) => {
    richiediAmministratore(chi(req))
    r.eliminaIngrediente(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  app.post(`${P}/reparti`, async (req, reply) => {
    richiediAmministratore(chi(req))
    const d = valida(SchemaNuovoReparto, req.body)
    return reply.code(201).send(r.creaReparto(db, d.id, d.nome))
  })
  app.put(`${P}/reparti/ordine`, async (req) => {
    richiediAmministratore(chi(req))
    return r.riordinaReparti(db, valida(SchemaRiordino, req.body).voci)
  })
  app.put<ConId>(`${P}/reparti/:id`, async (req) => {
    richiediAmministratore(chi(req))
    const d = valida(SchemaAggiornaReparto, req.body)
    return r.rinominaReparto(db, req.params.id, d.nome, d.versione)
  })
  app.delete<ConId>(`${P}/reparti/:id`, async (req, reply) => {
    richiediAmministratore(chi(req))
    r.eliminaReparto(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
}
