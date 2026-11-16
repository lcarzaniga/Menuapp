// Autenticazione: cookie di sessione, attivazione dei dispositivi su invito, account e
// amministrazione degli utenti (SPEC §19).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import {
  type Ingresso,
  SchemaAggiornaUtente,
  SchemaNuovaRichiesta,
  SchemaNuovoUtente,
} from '../../src/contratto/accesso.ts'
import { nonAutenticato, nonTrovato, troppiTentativi } from '../servizi/errori.ts'
import * as identita from '../servizi/identita.ts'
import { richiediAmministratore } from '../servizi/permessi.ts'
import { type Contesto, chi, valida } from './aiuti.ts'
import { Limitatore } from './limiti.ts'

const P = PREFISSO_API

/** Rotte API raggiungibili senza sessione: solo stato del servizio e attivazione. */
const RE_PUBBLICHE = new RegExp(`^${P}/(salute|accesso/(richiesta|completa))$`)
/** Rotte di amministrazione e di sistema: mai dall'ingresso pubblico. */
export const RE_SISTEMA = new RegExp(`^${P}/(admin/.*|backup(/.*)?|esportazione|ripristino/.*|foto/[^/]+/file)$`)

export function nomiCookie(sicuro: boolean) {
  // Il prefisso __Host- impone Secure, Path=/ e nessun Domain: il cookie resta di questo host.
  const p = sicuro ? '__Host-' : ''
  return { sessione: `${p}menuapp-sessione`, richiesta: `${p}menuapp-richiesta` }
}

export function leggiCookie(req: FastifyRequest, nome: string): string | null {
  const intestazione = req.headers.cookie
  if (!intestazione) return null
  for (const parte of intestazione.split(';')) {
    const i = parte.indexOf('=')
    if (i > 0 && parte.slice(0, i).trim() === nome) {
      const valore = parte.slice(i + 1).trim()
      return /^[A-Za-z0-9_-]{20,100}$/.test(valore) ? valore : null
    }
  }
  return null
}

function cookie(nome: string, valore: string, o: { maxAgeS: number; sameSite: 'Lax' | 'Strict'; sicuro: boolean }): string {
  return [`${nome}=${valore}`, 'Path=/', 'HttpOnly', `SameSite=${o.sameSite}`, `Max-Age=${o.maxAgeS}`, ...(o.sicuro ? ['Secure'] : [])].join('; ')
}

function aggiungiCookie(reply: FastifyReply, valore: string): void {
  const prima = reply.getHeader('set-cookie')
  const elenco = prima === undefined ? [] : Array.isArray(prima) ? prima.map(String) : [String(prima)]
  reply.header('set-cookie', [...elenco, valore])
}

/**
 * Controllo d'accesso su ogni richiesta API: la sessione del cookie identifica l'utente.
 * Senza sessione valida solo le rotte pubbliche rispondono.
 */
export function registraAutenticazione(app: FastifyInstance, ctx: Contesto, ingresso: Ingresso): void {
  const nomi = nomiCookie(ctx.config.cookieSicuro)
  app.decorateRequest('utente', null)
  app.addHook('onRequest', async (req, reply) => {
    const percorso = req.url.split('?')[0] ?? ''
    if (!percorso.startsWith('/api/')) return
    if (ingresso === 'pubblico' && RE_SISTEMA.test(percorso)) {
      reply.callNotFound()
      return reply
    }
    const token = leggiCookie(req, nomi.sessione)
    const s = token && ctx.db.isOpen ? identita.sessioneDaToken(ctx.db, token) : null
    if (s) {
      req.utente = { id: s.utente.id, nome: s.utente.nome, ruolo: s.utente.ruolo, sessioneId: s.sessioneId, ingresso }
      if (s.rinnovata) {
        aggiungiCookie(reply, cookie(nomi.sessione, token!, { maxAgeS: identita.DURATA_SESSIONE / 1000, sameSite: 'Lax', sicuro: ctx.config.cookieSicuro }))
      }
      return
    }
    if (RE_PUBBLICHE.test(percorso)) return
    throw nonAutenticato(token ? 'La sessione di questo dispositivo non è più valida' : undefined)
  })
}

export function rotteSessione(app: FastifyInstance, ctx: Contesto, ingresso: Ingresso): void {
  const { db, config } = ctx
  const nomi = nomiCookie(config.cookieSicuro)
  const sicuro = config.cookieSicuro
  // Tentativi di attivazione: per indirizzo e complessivi (ogni tentativo riuscito consuma un invito).
  const perIndirizzo = new Limitatore(10, 15 * 60_000)
  const complessivi = new Limitatore(60, 60 * 60_000)
  const urlInviti = () => config.urlPubblico ?? config.urlPrivato ?? config.origini[0] ?? ''

  // ── Pubbliche: attivazione del dispositivo ──────────────────

  app.post(`${P}/accesso/richiesta`, async (req, reply) => {
    if (!perIndirizzo.prova(req.ip) || !complessivi.prova('tutti')) throw troppiTentativi()
    const d = valida(SchemaNuovaRichiesta, req.body)
    const { segreto, stato } = identita.richiediAttivazione(db, { invito: d.invito, dispositivo: d.dispositivo, agente: String(req.headers['user-agent'] ?? '') })
    aggiungiCookie(reply, cookie(nomi.richiesta, segreto, { maxAgeS: identita.DURATA_RICHIESTA / 1000, sameSite: 'Strict', sicuro }))
    return reply.code(201).send(stato)
  })

  app.get(`${P}/accesso/richiesta`, async (req) => {
    const segreto = leggiCookie(req, nomi.richiesta)
    const stato = segreto ? identita.statoAttivazione(db, segreto) : null
    if (!stato) throw nonTrovato('Richiesta di attivazione')
    return stato
  })

  /** Dopo l'approvazione: il browser della richiesta riceve la sessione. */
  app.post(`${P}/accesso/completa`, async (req, reply) => {
    const segreto = leggiCookie(req, nomi.richiesta)
    const esito = segreto ? identita.completaAttivazione(db, segreto) : null
    if (!esito) throw nonTrovato('Richiesta approvata')
    aggiungiCookie(reply, cookie(nomi.sessione, esito.token, { maxAgeS: identita.DURATA_SESSIONE / 1000, sameSite: 'Lax', sicuro }))
    aggiungiCookie(reply, cookie(nomi.richiesta, '', { maxAgeS: 0, sameSite: 'Strict', sicuro }))
    return { ok: true }
  })

  // ── Sessione e account ──────────────────────────────────────

  app.get(`${P}/sessione`, async (req) => {
    const u = chi(req)
    return { utente: identita.leggiUtente(db, u.id), sessioneId: u.sessioneId, ingresso }
  })

  app.post(`${P}/sessione/esci`, async (req, reply) => {
    const u = chi(req)
    identita.revocaSessione(db, u, u.sessioneId)
    aggiungiCookie(reply, cookie(nomi.sessione, '', { maxAgeS: 0, sameSite: 'Lax', sicuro }))
    return { ok: true }
  })

  app.get(`${P}/persone`, async (req) => identita.elencaPersone(db, chi(req).id))

  app.get(`${P}/account/sessioni`, async (req) => identita.elencaSessioni(db, chi(req), false))
  app.delete<{ Params: { id: string } }>(`${P}/account/sessioni/:id`, async (req, reply) => {
    identita.revocaSessione(db, { ...chi(req), ruolo: 'utente' }, req.params.id)
    return reply.code(204).send()
  })
  /** Link per autorizzare un nuovo dispositivo dello stesso utente. */
  app.post(`${P}/account/inviti`, async (req, reply) => {
    const u = chi(req)
    return reply.code(201).send(identita.creaInvito(db, u, u.id, urlInviti()))
  })
  app.get(`${P}/account/richieste`, async (req) => identita.richiesteInAttesa(db, { ...chi(req), ruolo: 'utente' }))
  app.post<{ Params: { id: string } }>(`${P}/richieste/:id/approva`, async (req) => identita.decidiRichiesta(db, chi(req), req.params.id, 'approva'))
  app.post<{ Params: { id: string } }>(`${P}/richieste/:id/rifiuta`, async (req) => identita.decidiRichiesta(db, chi(req), req.params.id, 'rifiuta'))

  // ── Amministrazione (solo ingresso privato: vedi RE_SISTEMA) ─

  const admin = (req: FastifyRequest) => {
    const u = chi(req)
    richiediAmministratore(u)
    return u
  }
  app.get(`${P}/admin/utenti`, async (req) => {
    admin(req)
    return identita.elencaUtenti(db)
  })
  app.post(`${P}/admin/utenti`, async (req, reply) => {
    const u = admin(req)
    // Il nuovo familiare entra nella Famiglia di chi lo crea.
    return reply.code(201).send(identita.creaUtente(db, valida(SchemaNuovoUtente, req.body), Date.now(), identita.famigliaDi(db, u.id)))
  })
  app.put<{ Params: { id: string } }>(`${P}/admin/utenti/:id`, async (req) => identita.aggiornaUtente(db, admin(req), req.params.id, valida(SchemaAggiornaUtente, req.body)))
  app.post<{ Params: { id: string } }>(`${P}/admin/utenti/:id/inviti`, async (req, reply) =>
    reply.code(201).send(identita.creaInvito(db, admin(req), req.params.id, urlInviti())),
  )
  app.get(`${P}/admin/inviti`, async (req) => {
    admin(req)
    return identita.elencaInviti(db)
  })
  app.delete<{ Params: { id: string } }>(`${P}/admin/inviti/:id`, async (req, reply) => {
    identita.annullaInvito(db, admin(req), req.params.id)
    return reply.code(204).send()
  })
  app.get(`${P}/admin/richieste`, async (req) => identita.richiesteInAttesa(db, admin(req)))
  app.get(`${P}/admin/sessioni`, async (req) => identita.elencaSessioni(db, admin(req), true))
  app.delete<{ Params: { id: string } }>(`${P}/admin/sessioni/:id`, async (req, reply) => {
    identita.revocaSessione(db, admin(req), req.params.id)
    return reply.code(204).send()
  })
}
