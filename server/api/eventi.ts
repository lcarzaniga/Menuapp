// Rotte di eventi, portate e voci di menù (SPEC §12.4). Ogni rotta verifica il permesso
// dell'utente sull'evento (o sull'evento della voce) prima di leggere o scrivere.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SchemaFamigliaEvento, SchemaImpostaCondivisione, SchemaTrasferisci } from '../../src/contratto/accesso.ts'
import { PREFISSO_API, SchemaVersione } from '../../src/contratto/comune.ts'
import {
  SchemaAggiornaEvento,
  SchemaAggiornaVoce,
  SchemaImpostaVariante,
  SchemaNuoveVoci,
  SchemaNuovoEvento,
  SchemaRiordinoVoci,
} from '../../src/contratto/eventi.ts'
import { STATI_EVENTO } from '../../src/domain/tipi.ts'
import * as archivio from '../servizi/archivio.ts'
import * as condivisione from '../servizi/condivisione.ts'
import * as eventi from '../servizi/eventi.ts'
import * as varianti from '../servizi/varianti.ts'
import { fileAllegatiEvento, togliFile } from '../servizi/bacheca.ts'
import { avvisa, personeEvento } from '../servizi/notifiche.ts'
import { gruppiDiUtente } from '../servizi/gruppi.ts'
import { richiediEvento, richiediGruppo, richiediVoce, type UtenteCorrente } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaQueryStato = z.object({ stato: z.enum(STATI_EVENTO).optional(), gruppo: z.string().min(1).max(100).optional() })

export function rotteEventi(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API
  const risolvi = (u: UtenteCorrente, eventoId: string) => (piattoId: string) =>
    condivisione.piattoPerEvento(db, ctx.foto, u, eventoId, piattoId)
  /** Modifiche importanti al menù: una notifica raggruppata per evento. */
  const menuCambiato = (u: UtenteCorrente, eventoId: string, testo: string) =>
    avvisa(db, { tipo: 'menu', attoreId: u.id, destinatari: personeEvento(db, eventoId), chiave: `menu:${eventoId}`, eventoId, testo })

  // Con `gruppo` (Famiglia attiva, verificata): gli eventi di quella Famiglia più quelli personali.
  app.get(`${P}/eventi`, async (req) => {
    const u = chi(req)
    const q = valida(SchemaQueryStato, req.query)
    if (q.gruppo) richiediGruppo(db, u, q.gruppo)
    return eventi.elencaEventi(db, u.id, q.stato, q.gruppo)
  })

  app.post(`${P}/eventi`, async (req, reply) => {
    const u = chi(req)
    const d = valida(SchemaNuovoEvento, req.body)
    // La Famiglia scelta va verificata; senza scelta, l'unica dell'autore (se ne ha una sola).
    if (d.gruppoId) richiediGruppo(db, u, d.gruppoId)
    const famiglie = gruppiDiUtente(db, u.id)
    const gruppoId = d.gruppoId !== undefined ? d.gruppoId : famiglie.length === 1 ? famiglie[0]!.id : null
    const esito = eventi.creaEvento(db, d, u.id, Date.now(), gruppoId)
    return reply.code(esito.creato ? 201 : 200).send(esito.valore)
  })

  app.get<ConId>(`${P}/eventi/:id`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'lettura')
    return eventi.leggiEvento(db, req.params.id)
  })

  app.put<ConId>(`${P}/eventi/:id`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'modifica')
    const prima = eventi.leggiEvento(db, req.params.id)
    const dopo = eventi.aggiornaEvento(db, req.params.id, valida(SchemaAggiornaEvento, req.body))
    if (prima.data !== dopo.data || prima.oraServizio !== dopo.oraServizio) {
      menuCambiato(u, dopo.id, `Nuova data: ${dopo.data}${dopo.oraServizio ? ` alle ${dopo.oraServizio}` : ''}`)
    }
    return dopo
  })

  app.delete<ConId>(`${P}/eventi/:id`, async (req, reply) => {
    richiediEvento(db, chi(req), req.params.id, 'proprietario')
    // Le foto della bacheca dell'evento spariscono con lui.
    const file = fileAllegatiEvento(db, req.params.id)
    eventi.eliminaEvento(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    await togliFile(ctx.foto, file)
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
    menuCambiato(u, req.params.id, voci.length === 1 ? `Aggiunto «${voci[0]!.nome}» al menù` : `Aggiunti ${voci.length} piatti al menù`)
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

  // Ingredienti adattati per questo evento (SPEC §44): chi modifica l'evento; null torna alla ricetta.
  app.put<ConId>(`${P}/voci/:id/variante`, async (req) => {
    richiediVoce(db, chi(req), req.params.id, 'modifica')
    return varianti.impostaVariante(db, req.params.id, valida(SchemaImpostaVariante, req.body))
  })

  // «Usa una versione precedente»: solo eventi che l'utente vede (adattare richiede poi la modifica).
  app.get<ConId>(`${P}/voci/:id/varianti`, async (req) => {
    const u = chi(req)
    richiediVoce(db, u, req.params.id, 'lettura')
    return varianti.variantiPrecedenti(db, u, req.params.id)
  })

  app.delete<ConId>(`${P}/voci/:id`, async (req, reply) => {
    const u = chi(req)
    const eventoId = richiediVoce(db, u, req.params.id, 'modifica')
    const nome = eventi.leggiVoce(db, req.params.id).nome
    eventi.eliminaVoce(db, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    menuCambiato(u, eventoId, `Tolto «${nome}» dal menù`)
    return reply.code(204).send()
  })

  // ── Condivisione dell'evento ────────────────────────────────

  app.get<ConId>(`${P}/eventi/:id/accesso`, async (req) => condivisione.accessoEvento(db, chi(req), req.params.id))

  app.put<{ Params: { id: string; utenteId: string } }>(`${P}/eventi/:id/condivisioni/:utenteId`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'proprietario')
    const d = valida(SchemaImpostaCondivisione, req.body)
    return condivisione.condividiEvento(db, u, req.params.id, req.params.utenteId, d.permesso, Date.now(), d.partecipa)
  })

  app.delete<{ Params: { id: string; utenteId: string } }>(`${P}/eventi/:id/condivisioni/:utenteId`, async (req, reply) => {
    condivisione.revocaCondivisioneEvento(db, chi(req), req.params.id, req.params.utenteId)
    return reply.code(204).send()
  })

  app.put<ConId>(`${P}/eventi/:id/famiglia`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'proprietario')
    return condivisione.spostaInFamiglia(db, u, req.params.id, valida(SchemaFamigliaEvento, req.body).gruppoId)
  })

  app.post<ConId>(`${P}/eventi/:id/trasferisci`, async (req) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'proprietario')
    const d = valida(SchemaTrasferisci, req.body)
    return condivisione.trasferisciEvento(db, ctx.foto, u, req.params.id, d.utenteId, d.versione)
  })
}
