// Aiutanti per le rotte: validazione col contratto e contesto condiviso.
import type { z } from 'zod'
import type { Config } from '../config.ts'
import type { Db } from '../db/connessione.ts'
import type { RegistroRipristini } from '../backup/ripristino.ts'
import type { FastifyRequest } from 'fastify'
import { nonAutenticato, richiestaNonValida } from '../servizi/errori.ts'
import type { UtenteCorrente } from '../servizi/permessi.ts'

declare module 'fastify' {
  interface FastifyRequest {
    /** Utente della sessione, impostato dal controllo d'accesso (null sulle rotte pubbliche). */
    utente: UtenteCorrente | null
  }
}

/** Utente corrente: ogni rotta protetta lo richiede esplicitamente. */
export function chi(req: FastifyRequest): UtenteCorrente {
  if (!req.utente) throw nonAutenticato()
  return req.utente
}

export interface StatoServizio {
  /** true durante un ripristino: le API rispondono 503. */
  manutenzione: boolean
}

export interface Contesto {
  db: Db
  config: Config
  stato: StatoServizio
  versioneApp: string
  ripristini: RegistroRipristini
}

/** Valida un ingresso con lo schema del contratto; 400 con i dettagli per campo. */
export function valida<S extends z.ZodType>(schema: S, dati: unknown): z.infer<S> {
  const r = schema.safeParse(dati)
  if (r.success) return r.data
  const campi = r.error.issues.map((i) => ({ campo: i.path.join('.'), messaggio: i.message }))
  throw richiestaNonValida(campi[0] ? `${campi[0].campo || 'richiesta'}: ${campi[0].messaggio}` : 'Richiesta non valida', { campi })
}
