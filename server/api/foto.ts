// Rotte delle foto e dell'esportazione della ricetta (formato v1).
import type { FastifyInstance } from 'fastify'
import { strToU8, zipSync } from 'fflate'
import { z } from 'zod'
import { PREFISSO_API } from '../../src/contratto/comune.ts'
import { SchemaAggiornaFoto, SchemaQueryCaricaFoto } from '../../src/contratto/foto.ts'
import { daPiatto, nomeFileRicetta } from '../../src/domain/ricetta/formato.ts'
import * as foto from '../servizi/foto.ts'
import { elencaPiatti, leggiPiatto } from '../servizi/ricettario.ts'
import { richiediFoto, richiediPiatto, richiediSistema } from '../servizi/permessi.ts'
import { attivitaDaSnapshot, menuDaSnapshot, spesaDaSnapshot } from '../servizi/archivio.ts'
import { elencaAttivita } from '../servizi/attivita.ts'
import { elencaEventi, leggiMenu } from '../servizi/eventi.ts'
import { listaSpesa } from '../servizi/spesa.ts'
import { leggiStileStampa } from '../servizi/stampa.ts'
import { chi, type Contesto, valida } from './aiuti.ts'

type ConId = { Params: { id: string } }
const SchemaQueryVersione = z.object({ versione: z.coerce.number().int().min(0) })

export function rotteFoto(app: FastifyInstance, ctx: Contesto): void {
  const { db, config } = ctx
  const P = PREFISSO_API

  app.post<ConId>(`${P}/piatti/:id/foto`, async (req, reply) => {
    richiediPiatto(db, chi(req), req.params.id, 'proprietario')
    const q = valida(SchemaQueryCaricaFoto, req.query)
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ errore: { codice: 'tipo_non_supportato', messaggio: 'Invia il file dell\'immagine' } })
    const f = await foto.caricaFoto(db, config.cartellaFoto, req.params.id, { id: q.id, dati: req.body, didascalia: q.didascalia, principale: q.principale === '1', passo: q.passo ?? null })
    return reply.code(201).send(f)
  })

  // Il file della foto è servito solo a chi può leggere la ricetta.
  app.get<ConId>(`${P}/foto/:id`, async (req, reply) => {
    richiediFoto(db, chi(req), req.params.id, 'lettura')
    const f = foto.leggiFoto(db, req.params.id)
    const dati = await foto.leggiFile(config.cartellaFoto, f)
    // id unico e contenuto immutabile: il browser può tenerla in cache a lungo.
    return reply.header('content-type', f.tipo).header('cache-control', 'private, max-age=31536000, immutable').send(dati)
  })

  app.put<ConId>(`${P}/foto/:id`, async (req) => {
    richiediFoto(db, chi(req), req.params.id, 'proprietario')
    return foto.aggiornaFoto(db, req.params.id, valida(SchemaAggiornaFoto, req.body))
  })

  app.delete<ConId>(`${P}/foto/:id`, async (req, reply) => {
    richiediFoto(db, chi(req), req.params.id, 'proprietario')
    await foto.eliminaFoto(db, config.cartellaFoto, req.params.id, valida(SchemaQueryVersione, req.query).versione)
    return reply.code(204).send()
  })

  /** Rimette il file di una foto registrata ma mancante (ripristino da esportazione ZIP). */
  app.put<ConId>(`${P}/foto/:id/file`, async (req, reply) => {
    richiediSistema(chi(req))
    if (!Buffer.isBuffer(req.body)) return reply.code(415).send({ errore: { codice: 'tipo_non_supportato', messaggio: 'Invia il file dell\'immagine' } })
    await foto.rimettiFile(db, config.cartellaFoto, req.params.id, req.body)
    return reply.code(204).send()
  })

  app.get<ConId>(`${P}/piatti/:id/esporta`, async (req, reply) => {
    richiediPiatto(db, chi(req), req.params.id, 'lettura')
    const p = leggiPiatto(db, req.params.id, chi(req).id)
    const elenco = foto.elencaFoto(db, p.id)
    const file: Record<string, Uint8Array> = {}
    const voci = []
    for (const [k, f] of elenco.entries()) {
      const nome = `foto/${k + 1}.${foto.ESTENSIONI[f.tipo]}`
      file[nome] = await foto.leggiFile(config.cartellaFoto, f)
      voci.push({ file: nome, didascalia: f.didascalia, principale: f.principale, ...(f.passo === null ? {} : { passo: f.passo + 1 }) })
    }
    file['ricetta.json'] = strToU8(JSON.stringify(daPiatto(p, voci), null, 2))
    const zip = zipSync(file, { level: 0 })
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${nomeFileRicetta(p.nome)}"`)
      .send(Buffer.from(zip))
  })

  /**
   * «Esporta i miei dati»: eventi di cui l'utente è proprietario (con menù, spesa, piano e
   * stile di stampa) e le sue ricette nel formato v1 con le foto. Niente dati di altri.
   */
  app.get(`${P}/account/esportazione`, async (req, reply) => {
    const u = chi(req)
    const file: Record<string, Uint8Array> = {}
    const ricette = []
    for (const r of elencaPiatti(db, u.id).filter((x) => x.mio)) {
      const p = leggiPiatto(db, r.id, u.id)
      const voci = []
      for (const [k, f] of p.foto.entries()) {
        const nome = `ricette/${p.id}/foto/${k + 1}.${foto.ESTENSIONI[f.tipo]}`
        try {
          file[nome] = await foto.leggiFile(config.cartellaFoto, f)
          voci.push({ file: nome, didascalia: f.didascalia, principale: f.principale, ...(f.passo === null ? {} : { passo: f.passo + 1 }) })
        } catch {
          // file mancante: la ricetta si esporta senza quella foto
        }
      }
      ricette.push(daPiatto(p, voci))
    }
    const eventiPropri = elencaEventi(db, u.id).filter((e) => e.permesso === 'proprietario')
    const contenuto = {
      formato: 'menuapp-dati-personali',
      versione: 1,
      esportatoIl: new Date().toISOString(),
      utente: { id: u.id, nome: u.nome },
      eventi: eventiPropri.map((e) => {
        const archiviato = e.stato === 'archiviato'
        return {
          evento: e,
          menu: archiviato ? menuDaSnapshot(db, e.id) : leggiMenu(db, e.id),
          spesa: archiviato ? spesaDaSnapshot(db, e.id) : listaSpesa(db, e.id),
          attivita: archiviato ? attivitaDaSnapshot(db, e.id) : elencaAttivita(db, e.id),
          stampa: leggiStileStampa(db, e.id).opzioni,
        }
      }),
      ricette,
    }
    file['dati.json'] = strToU8(JSON.stringify(contenuto, null, 2))
    const giorno = new Date().toISOString().slice(0, 10)
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="menuapp-miei-dati-${giorno}.zip"`)
      .send(Buffer.from(zipSync(file, { level: 0 })))
  })
}
