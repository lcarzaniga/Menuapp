// Rotte dello stile del menù stampato (SPEC F8).
import type { FastifyInstance } from 'fastify'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaSalvaStileStampa } from '../../src/contratto/stampa.ts'
import * as stampa from '../servizi/stampa.ts'
import { richiediEvento } from '../servizi/permessi.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }

export function rotteStampa(app: FastifyInstance, ctx: Contesto): void {
  const { db } = ctx
  const P = PREFISSO_API

  app.get<ConId>(`${P}/eventi/:id/stampa`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'lettura')
    return stampa.leggiStileStampa(db, req.params.id)
  })

  app.put<ConId>(`${P}/eventi/:id/stampa`, async (req) => {
    richiediEvento(db, chi(req), req.params.id, 'modifica')
    return stampa.salvaStileStampa(db, req.params.id, valida(SchemaSalvaStileStampa, req.body))
  })
}
