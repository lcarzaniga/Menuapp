// Rotte dello spazio della famiglia: gruppi, bacheche, sondaggi, proposte, notifiche (SPEC §20).
// Ogni rotta verifica l'accesso alla risorsa prima di validare il corpo.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import {
  REAZIONI,
  SchemaAccettaInvito,
  SchemaAggiornaCommento,
  SchemaNuovaFamiglia,
  SchemaPassaAmministrazione,
  SchemaRinominaFamiglia,
  SchemaAggiornaCosa,
  SchemaAggiornaEsterno,
  SchemaNuovoEsterno,
  SchemaAssegna,
  SchemaCompleta,
  SchemaNuovaCosa,
  SchemaPrendi,
  SchemaValuta,
  SchemaAggiornaMessaggio,
  SchemaDecisione,
  SchemaFissa,
  SchemaInserisciProposta,
  SchemaNuovoCommento,
  SchemaNuovoMessaggio,
  SchemaPreferenze,
  SchemaVoto,
} from '../../src/contratto/famiglia.ts'
import { Id } from '../../src/contratto/comune.ts'
import * as bacheca from '../servizi/bacheca.ts'
import { leggiFile } from '../servizi/foto.ts'
import * as famiglia from '../servizi/gruppi.ts'
import * as incarichi from '../servizi/incarichi.ts'
import * as notifiche from '../servizi/notifiche.ts'
import * as rubrica from '../servizi/rubrica.ts'
import * as valutazioni from '../servizi/valutazioni.ts'
import { richiediAmministratore, richiediEvento, richiediGruppo, richiediVoce } from '../servizi/permessi.ts'
import { richiestaNonValida } from '../servizi/errori.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryAllegato = z.object({ id: Id })
const SchemaReazione = z.enum(REAZIONI)
const SchemaMembro = z.object({ ruolo: z.enum(['amministratore', 'membro']) })
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })
const SchemaFiltriClassifica = z.object({ portata: z.string().max(100).optional(), anno: z.string().regex(/^\d{4}$/).optional(), gruppo: Id.optional() })

export function rotteFamiglia(app: FastifyInstance, ctx: Contesto): void {
  const { db, config } = ctx
  const P = PREFISSO_API

  // ── Famiglie ──
  const urlInviti = () => config.urlPubblico ?? config.urlPrivato ?? config.origini[0] ?? ''
  app.get(`${P}/gruppi`, async (req) => famiglia.gruppiDi(db, chi(req)))
  app.post(`${P}/famiglie`, async (req, reply) => reply.code(201).send(famiglia.creaFamiglia(db, chi(req), valida(SchemaNuovaFamiglia, req.body))))
  app.put<ConId>(`${P}/famiglie/:id`, async (req) => {
    const u = chi(req)
    richiediGruppo(db, u, req.params.id, 'amministratore')
    const d = valida(SchemaRinominaFamiglia, req.body)
    return famiglia.rinomina(db, u, req.params.id, d.nome, d.versione)
  })
  app.post<ConId>(`${P}/famiglie/:id/inviti`, async (req, reply) => reply.code(201).send(famiglia.creaInvito(db, chi(req), req.params.id, urlInviti())))
  app.get<ConId>(`${P}/famiglie/:id/inviti`, async (req) => famiglia.invitiDi(db, chi(req), req.params.id))
  app.delete<{ Params: { id: string; invito: string } }>(`${P}/famiglie/:id/inviti/:invito`, async (req, reply) => {
    famiglia.annullaInvito(db, chi(req), req.params.id, req.params.invito)
    return reply.code(204).send()
  })
  // Il token viaggia nel corpo (non nell'indirizzo), come per l'attivazione dei dispositivi.
  app.post(`${P}/inviti-famiglia/anteprima`, async (req) => famiglia.anteprimaInvito(db, chi(req), valida(SchemaAccettaInvito, req.body).token))
  app.post(`${P}/inviti-famiglia/accetta`, async (req) => famiglia.accettaInvito(db, chi(req), valida(SchemaAccettaInvito, req.body).token))
  app.post<ConId>(`${P}/famiglie/:id/esci`, async (req) => {
    famiglia.esci(db, chi(req), req.params.id)
    return { ok: true }
  })
  app.delete<{ Params: { id: string; utenteId: string } }>(`${P}/famiglie/:id/membri/:utenteId`, async (req) => famiglia.rimuovi(db, chi(req), req.params.id, req.params.utenteId))
  app.put<{ Params: { id: string; utenteId: string } }>(`${P}/famiglie/:id/membri/:utenteId`, async (req) => {
    const u = chi(req)
    richiediGruppo(db, u, req.params.id, 'amministratore')
    return famiglia.impostaRuolo(db, u, req.params.id, req.params.utenteId, valida(SchemaMembro, req.body).ruolo)
  })
  app.post<ConId>(`${P}/famiglie/:id/amministrazione`, async (req) => {
    const u = chi(req)
    richiediGruppo(db, u, req.params.id, 'amministratore')
    return famiglia.passaAmministrazione(db, u, req.params.id, valida(SchemaPassaAmministrazione, req.body).utenteId)
  })
  app.put<{ Params: { id: string; utenteId: string } }>(`${P}/admin/gruppi/:id/membri/:utenteId`, async (req) => {
    richiediAmministratore(chi(req))
    return famiglia.impostaMembro(db, req.params.id, req.params.utenteId, valida(SchemaMembro, req.body).ruolo)
  })
  app.delete<{ Params: { id: string; utenteId: string } }>(`${P}/admin/gruppi/:id/membri/:utenteId`, async (req, reply) => {
    richiediAmministratore(chi(req))
    famiglia.togliMembro(db, req.params.id, req.params.utenteId)
    return reply.code(204).send()
  })
  app.get(`${P}/admin/gruppi`, async (req) => {
    richiediAmministratore(chi(req))
    return famiglia.tuttiIGruppi(db)
  })

  // ── Bacheche ──
  app.get<ConId>(`${P}/gruppi/:id/bacheca`, async (req) => bacheca.leggiBacheca(db, chi(req), { gruppoId: req.params.id, eventoId: null }))
  app.post<ConId>(`${P}/gruppi/:id/messaggi`, async (req, reply) => {
    const u = chi(req)
    richiediGruppo(db, u, req.params.id)
    return reply.code(201).send(bacheca.pubblica(db, u, { gruppoId: req.params.id, eventoId: null }, valida(SchemaNuovoMessaggio, req.body)))
  })
  app.get<ConId>(`${P}/eventi/:id/bacheca`, async (req) => bacheca.leggiBacheca(db, chi(req), { gruppoId: null, eventoId: req.params.id }))
  app.post<ConId>(`${P}/eventi/:id/messaggi`, async (req, reply) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'partecipa')
    return reply.code(201).send(bacheca.pubblica(db, u, { gruppoId: null, eventoId: req.params.id }, valida(SchemaNuovoMessaggio, req.body)))
  })

  // ── Messaggi ──
  const messaggio = (req: { params: { id: string } } & Parameters<typeof chi>[0]) => {
    const u = chi(req)
    bacheca.richiediMessaggio(db, u, req.params.id)
    return u
  }
  app.get<ConId>(`${P}/messaggi/:id`, async (req) => bacheca.leggiMessaggio(db, chi(req), req.params.id))
  app.put<ConId>(`${P}/messaggi/:id`, async (req) => {
    const u = messaggio(req)
    const d = valida(SchemaAggiornaMessaggio, req.body)
    return bacheca.modifica(db, u, req.params.id, d.testo, d.versione)
  })
  app.delete<ConId>(`${P}/messaggi/:id`, async (req, reply) => {
    const file = bacheca.elimina(db, chi(req), req.params.id)
    await bacheca.togliFile(config.cartellaFoto, file)
    return reply.code(204).send()
  })
  app.put<ConId>(`${P}/messaggi/:id/fissato`, async (req) => {
    const u = messaggio(req)
    return bacheca.fissa(db, u, req.params.id, valida(SchemaFissa, req.body).fissato)
  })
  app.post<ConId>(`${P}/messaggi/:id/commenti`, async (req, reply) => {
    const u = messaggio(req)
    return reply.code(201).send(bacheca.commenta(db, u, req.params.id, valida(SchemaNuovoCommento, req.body)))
  })
  app.put<ConId>(`${P}/commenti/:id`, async (req) => {
    const u = chi(req)
    bacheca.richiediCommento(db, u, req.params.id)
    const d = valida(SchemaAggiornaCommento, req.body)
    return bacheca.modificaCommento(db, u, req.params.id, d.testo, d.versione)
  })
  app.delete<ConId>(`${P}/commenti/:id`, async (req, reply) => {
    bacheca.eliminaCommento(db, chi(req), req.params.id)
    return reply.code(204).send()
  })
  app.put<{ Params: { id: string; reazione: string } }>(`${P}/messaggi/:id/reazioni/:reazione`, async (req) => {
    const u = messaggio(req)
    return bacheca.reagisci(db, u, req.params.id, valida(SchemaReazione, req.params.reazione), true)
  })
  app.delete<{ Params: { id: string; reazione: string } }>(`${P}/messaggi/:id/reazioni/:reazione`, async (req) => {
    const u = messaggio(req)
    return bacheca.reagisci(db, u, req.params.id, valida(SchemaReazione, req.params.reazione), false)
  })

  // ── Fotografie dei messaggi ──
  app.post<ConId>(`${P}/messaggi/:id/allegati`, async (req, reply) => {
    const u = messaggio(req)
    const q = valida(SchemaQueryAllegato, req.query)
    if (!Buffer.isBuffer(req.body)) throw richiestaNonValida('Invia il file dell\'immagine')
    return reply.code(201).send(await bacheca.allega(db, config.cartellaFoto, u, req.params.id, { id: q.id, dati: req.body }))
  })
  app.get<ConId>(`${P}/allegati/:id`, async (req, reply) => {
    const a = bacheca.leggiAllegato(db, chi(req), req.params.id)
    const dati = await leggiFile(config.cartellaFoto, a)
    return reply.header('content-type', a.tipo).header('cache-control', 'private, max-age=31536000, immutable').send(dati)
  })

  // ── Sondaggi ──
  app.put<ConId>(`${P}/messaggi/:id/voto`, async (req) => {
    const u = messaggio(req)
    return bacheca.vota(db, u, req.params.id, valida(SchemaVoto, req.body).opzioni)
  })
  app.post<ConId>(`${P}/messaggi/:id/chiudi`, async (req) => bacheca.chiudi(db, messaggio(req), req.params.id))

  // ── Proposte di piatti ──
  app.put<ConId>(`${P}/messaggi/:id/decisione`, async (req) => {
    const u = messaggio(req)
    bacheca.richiediDecisione(db, u, req.params.id)
    return bacheca.decidi(db, u, req.params.id, valida(SchemaDecisione, req.body).stato)
  })
  app.post<ConId>(`${P}/messaggi/:id/inserisci`, async (req) => {
    const u = messaggio(req)
    bacheca.richiediDecisione(db, u, req.params.id)
    return bacheca.inserisciNelMenu(db, config.cartellaFoto, u, req.params.id, valida(SchemaInserisciProposta, req.body).portataId)
  })

  // ── Notifiche ──
  app.get(`${P}/notifiche`, async (req) => notifiche.elencaNotifiche(db, chi(req)))
  app.get(`${P}/notifiche/conteggio`, async (req) => ({ nonLette: notifiche.contaNonLette(db, chi(req)) }))
  app.post<ConId>(`${P}/notifiche/:id/letta`, async (req) => {
    notifiche.segnaLetta(db, chi(req), req.params.id)
    return { ok: true }
  })
  app.post(`${P}/notifiche/lette`, async (req) => {
    notifiche.segnaTutteLette(db, chi(req))
    return { ok: true }
  })
  app.get(`${P}/notifiche/preferenze`, async (req) => notifiche.preferenze(db, chi(req)))
  app.put(`${P}/notifiche/preferenze`, async (req) => {
    const u = chi(req)
    return notifiche.impostaPreferenze(db, u, valida(SchemaPreferenze, req.body).disattivate)
  })

  // ── Chi porta cosa ──
  app.get<ConId>(`${P}/eventi/:id/incarichi`, async (req) => incarichi.elenca(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/eventi/:id/cose`, async (req, reply) => {
    const u = chi(req)
    richiediEvento(db, u, req.params.id, 'lettura')
    return reply.code(201).send(incarichi.creaCosa(db, u, req.params.id, valida(SchemaNuovaCosa, req.body)))
  })
  app.put<ConId>(`${P}/cose/:id`, async (req) => {
    const u = chi(req)
    incarichi.richiediIncarico(db, u, 'cosa', req.params.id)
    return incarichi.aggiornaCosa(db, u, req.params.id, valida(SchemaAggiornaCosa, req.body))
  })
  app.delete<ConId>(`${P}/cose/:id`, async (req, reply) => {
    const u = chi(req)
    incarichi.richiediIncarico(db, u, 'cosa', req.params.id)
    incarichi.eliminaCosa(db, u, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })
  for (const tipo of ['voce', 'cosa'] as const) {
    const base = `${P}/${tipo === 'voce' ? 'voci' : 'cose'}/:id`
    const prima = (req: Parameters<typeof chi>[0] & { params: { id: string } }) => {
      const u = chi(req)
      incarichi.richiediIncarico(db, u, tipo, req.params.id)
      return u
    }
    app.post<ConId>(`${base}/prendi`, async (req) => {
      const u = prima(req)
      const d = valida(SchemaPrendi, req.body)
      return incarichi.prendi(db, u, tipo, req.params.id, d.versione, d.togliDallaSpesa)
    })
    app.post<ConId>(`${base}/rinuncia`, async (req) => {
      const u = prima(req)
      return incarichi.rinuncia(db, u, tipo, req.params.id, valida(SchemaQueryVersione, req.body).versione)
    })
    app.post<ConId>(`${base}/assegna`, async (req) => {
      const u = chi(req)
      // Assegnare spetta a chi organizza: controllo prima di leggere il corpo.
      richiediEvento(db, u, incarichi.richiediIncarico(db, u, tipo, req.params.id), 'modifica')
      return incarichi.assegna(db, u, tipo, req.params.id, valida(SchemaAssegna, req.body))
    })
    app.post<ConId>(`${base}/completa`, async (req) => {
      const u = prima(req)
      const d = valida(SchemaCompleta, req.body)
      return incarichi.completa(db, u, tipo, req.params.id, d.versione, d.completato)
    })
  }

  // ── Rubrica delle persone senza account (per Famiglia) ──
  app.get<ConId>(`${P}/famiglie/:id/rubrica`, async (req) => rubrica.elenca(db, chi(req), req.params.id))
  app.post<ConId>(`${P}/famiglie/:id/rubrica`, async (req, reply) => {
    const u = chi(req)
    richiediGruppo(db, u, req.params.id)
    return reply.code(201).send(rubrica.crea(db, u, req.params.id, valida(SchemaNuovoEsterno, req.body)))
  })
  app.put<ConId>(`${P}/rubrica/:id`, async (req) => {
    const u = chi(req)
    rubrica.richiedi(db, u, req.params.id)
    return rubrica.aggiorna(db, u, req.params.id, valida(SchemaAggiornaEsterno, req.body))
  })
  app.delete<ConId>(`${P}/rubrica/:id`, async (req, reply) => {
    rubrica.elimina(db, chi(req), req.params.id)
    return reply.code(204).send()
  })

  // ── Valutazioni ──
  app.get<ConId>(`${P}/eventi/:id/valutazioni`, async (req) => valutazioni.dellEvento(db, chi(req), req.params.id))
  app.put<ConId>(`${P}/voci/:id/valutazione`, async (req) => {
    const u = chi(req)
    richiediVoce(db, u, req.params.id, 'lettura')
    return valutazioni.valuta(db, u, req.params.id, valida(SchemaValuta, req.body).stelle)
  })
  app.delete<ConId>(`${P}/voci/:id/valutazione`, async (req) => {
    const u = chi(req)
    richiediVoce(db, u, req.params.id, 'lettura')
    return valutazioni.togli(db, u, req.params.id)
  })
  app.get(`${P}/classifica`, async (req) => {
    const u = chi(req)
    const f = valida(SchemaFiltriClassifica, req.query)
    if (f.gruppo) richiediGruppo(db, u, f.gruppo)
    return valutazioni.classifica(db, u, f)
  })
}
