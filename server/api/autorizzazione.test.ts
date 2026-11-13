// Autorizzazione (SPEC §19.3–15.4): ogni rotta con l'id di una risorsa verificata per
// proprietario, invitato in modifica, invitato in lettura e utente senza accesso.
import { unzipSync, strFromU8 } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // modifica
let bruno: ClientDiProva & { id: string } // lettura
let carla: ClientDiProva & { id: string } // nessun accesso
let snapshot: string
const P = '/api/v1'
const corpo = (r: { body: string }) => JSON.parse(r.body)
const jpeg = (n = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n), Buffer.from([0xff, 0xd9])])

async function ok(r: Promise<{ statusCode: number; body: string }>) {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return corpo(x)
}

async function nuovoEvento(client: ClientDiProva, id: string, nome = 'Natale') {
  return ok(client.scrivi('POST', `${P}/eventi`, { id, nome, data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 2, note: '' }))
}

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  carla = t.utente('Carla')
  // Evento di Loris con menù collegato a una ricetta con foto, spesa, piano, stile.
  const ev = await nuovoEvento(t, 'ev')
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-lasagne', nome: 'Lasagne', porzioniBase: 4, ingredienti: [] }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-privato', nome: 'Ricetta segreta', ingredienti: [] }))
  await ok(t.inietta({ method: 'POST', url: `${P}/piatti/p-lasagne/foto?id=f1`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: jpeg() }))
  await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[1].id, nome: 'Lasagne', piattoId: 'p-lasagne' }] }))
  await ok(t.scrivi('POST', `${P}/eventi/ev/spesa/manuali`, { id: 'm1', nome: 'Ghiaccio', quantitaTesto: '', repartoId: null, nota: '' }))
  await ok(t.scrivi('POST', `${P}/eventi/ev/attivita`, { id: 'a1', titolo: 'Ragù', data: '2026-12-24', ora: null, voceMenuId: 'v1', note: '' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'modifica' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'lettura' }))
  // Evento archiviato con snapshot, condiviso allo stesso modo.
  const ar = await nuovoEvento(t, 'ar', 'Pasqua')
  await ok(t.scrivi('PUT', `${P}/eventi/ar/condivisioni/${anna.id}`, { permesso: 'modifica' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ar/condivisioni/${bruno.id}`, { permesso: 'lettura' }))
  await ok(t.scrivi('POST', `${P}/eventi/ar/archivia`, { versione: ar.versione }))
  snapshot = corpo(await t.leggi(`${P}/eventi/ar/snapshot`))[0].id
})
afterEach(() => t.chiudi())

/** Id reale da usare per ogni parametro, in base alla risorsa del percorso. */
function percorsoReale(url: string): string {
  return url
    .replace(/\/eventi\/:id\/riapertura/, '/eventi/ar/riapertura')
    .replace(/\/eventi\/:id/, '/eventi/ev')
    .replace(/\/voci\/:id/, '/voci/v1')
    .replace(/\/attivita\/:id/, '/attivita/a1')
    .replace(/\/spesa\/manuali\/:id/, '/spesa/manuali/m1')
    .replace(/\/snapshot\/:id/, `/snapshot/${snapshot}`)
    .replace(/\/piatti\/:id/, '/piatti/p-lasagne')
    .replace(/\/foto\/:id/, '/foto/f1')
    .replace(/:chiave/, 'chiave-prova')
    .replace(/:utenteId/, 'utente-carla')
}

const richiesta = (c: ClientDiProva, metodo: string, url: string) =>
  t.app.inject({
    method: metodo as 'GET',
    url,
    headers: { origin: ORIGINE_PROVA, cookie: c.cookie!, ...(metodo === 'GET' || metodo === 'DELETE' ? {} : { 'content-type': 'application/json' }) },
    payload: metodo === 'GET' || metodo === 'DELETE' ? undefined : '{}',
  })

describe('accesso diretto a ogni rotta con id', () => {
  const RISORSE = /\/(eventi|voci|attivita|spesa\/manuali|snapshot|piatti|foto)\/:id/

  it('un utente senza accesso riceve 404 (come per un id inesistente) prima di qualsiasi validazione', async () => {
    const rotte = t.app.rotte.filter((r) => RISORSE.test(r.url) && !r.url.endsWith('/foto/:id/file'))
    expect(rotte.length).toBeGreaterThan(45)
    for (const r of rotte) {
      const reale = await richiesta(carla, r.metodo, percorsoReale(r.url))
      const inesistente = await richiesta(carla, r.metodo, r.url.replace(/:(\w+)/g, 'inesistente'))
      expect(reale.statusCode, `${r.metodo} ${r.url} → ${reale.body}`).toBe(404)
      // Indistinguibile da una risorsa che non esiste.
      expect(corpo(reale), `${r.metodo} ${r.url}`).toEqual(corpo(inesistente))
    }
  })

  it('invitato in lettura: legge tutto, non scrive nulla (403)', async () => {
    for (const r of t.app.rotte.filter((x) => RISORSE.test(x.url) && x.url.startsWith(`${P}/`) && !x.url.endsWith('/foto/:id/file'))) {
      const res = await richiesta(bruno, r.metodo, percorsoReale(r.url))
      // Con chi è condivisa una ricetta lo vede solo il proprietario.
      const soloProprietarioRicetta = r.url.endsWith('/piatti/:id/condivisioni')
      const lettura = (r.metodo === 'GET' && !soloProprietarioRicetta) || r.url.endsWith('/copia-piatto') || r.url.endsWith('/piatti/:id/copia')
      const piattoAltrui = (/\/(piatti|foto)\/:id/.test(r.url) && r.metodo !== 'GET' && !r.url.endsWith('/copia')) || soloProprietarioRicetta
      const lasciaEvento = r.metodo === 'DELETE' && r.url.endsWith('/condivisioni/:utenteId')
      if (lettura) expect([200, 201, 400], `${r.metodo} ${r.url} → ${res.body}`).toContain(res.statusCode)
      else if (piattoAltrui || !lasciaEvento) expect(res.statusCode, `${r.metodo} ${r.url} → ${res.body}`).toBe(403)
    }
  })

  it('invitato in modifica: lavora su menù, spesa, piano e stampa; non sulle azioni del proprietario né sulle ricette altrui', async () => {
    const SOLO_PROPRIETARIO = [
      `DELETE ${P}/eventi/:id`,
      `POST ${P}/eventi/:id/archivia`,
      `POST ${P}/eventi/:id/trasferisci`,
      `PUT ${P}/eventi/:id/condivisioni/:utenteId`,
    ]
    for (const r of t.app.rotte.filter((x) => RISORSE.test(x.url) && !x.url.endsWith('/foto/:id/file'))) {
      const chiave = `${r.metodo} ${r.url}`
      const res = await richiesta(anna, r.metodo, percorsoReale(r.url))
      const ricettaAltrui = (/\/(piatti|foto)\/:id/.test(r.url) && r.metodo !== 'GET' && !r.url.endsWith('/copia')) || r.url.endsWith('/piatti/:id/condivisioni')
      if (SOLO_PROPRIETARIO.includes(chiave) || ricettaAltrui) expect(res.statusCode, `${chiave} → ${res.body}`).toBe(403)
      else if (chiave === `DELETE ${P}/eventi/:id/condivisioni/:utenteId`) expect(res.statusCode).toBe(403) // revocare altri: no
      else expect([200, 201, 204, 400, 409, 422], `${chiave} → ${res.body}`).toContain(res.statusCode)
    }
  })
})

describe('eventi', () => {
  it('elenco: proprietario vede i suoi, gli invitati i condivisi con il permesso, gli altri niente', async () => {
    const perLoris = corpo(await t.leggi(`${P}/eventi`))
    expect(perLoris.map((e: { id: string; permesso: string }) => [e.id, e.permesso]).sort()).toEqual([
      ['ar', 'proprietario'],
      ['ev', 'proprietario'],
    ])
    expect(corpo(await anna.leggi(`${P}/eventi`)).map((e: { id: string; permesso: string; proprietario: { nome: string } }) => [e.id, e.permesso, e.proprietario.nome]).sort()).toEqual([
      ['ar', 'modifica', 'Loris'],
      ['ev', 'modifica', 'Loris'],
    ])
    expect(corpo(await bruno.leggi(`${P}/eventi`)).every((e: { permesso: string }) => e.permesso === 'lettura')).toBe(true)
    expect(corpo(await carla.leggi(`${P}/eventi`))).toEqual([])
    expect(corpo(await carla.leggi(`${P}/eventi?stato=archiviato`))).toEqual([])
  })

  it('eventi nuovi sono privati; un id già usato da altri non rivela il contenuto', async () => {
    await nuovoEvento(carla, 'ev-carla', 'Compleanno')
    expect(corpo(await t.leggi(`${P}/eventi`)).map((e: { id: string }) => e.id)).not.toContain('ev-carla')
    expect((await t.leggi(`${P}/eventi/ev-carla`)).statusCode).toBe(404)
    // Carla ripete la creazione con l'id dell'evento di Loris e i suoi stessi dati.
    const r = await carla.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 2, note: '' })
    expect(r.statusCode).toBe(409)
    expect(corpo(r).errore.codice).toBe('id_esistente')
    expect(corpo(r).errore.dettagli).toBeUndefined()
  })

  it('409 di versione: solo a chi ha accesso, mai con i dati agli altri', async () => {
    const voce = corpo(await t.leggi(`${P}/voci/v1`))
    await ok(t.scrivi('PUT', `${P}/voci/v1`, { ...voce, nome: 'Lasagne al ragù' }))
    const vecchia = { nome: 'X', piattoId: 'p-lasagne', porzioni: null, incaricato: '', inSpesa: true, note: '', versione: voce.versione }
    const perAnna = await anna.scrivi('PUT', `${P}/voci/v1`, vecchia)
    expect(perAnna.statusCode).toBe(409)
    expect(corpo(perAnna).errore.dettagli.attuale.nome).toBe('Lasagne al ragù')
    const perCarla = await carla.scrivi('PUT', `${P}/voci/v1`, vecchia)
    expect(perCarla.statusCode).toBe(404)
    expect(perCarla.body).not.toContain('Lasagne')
  })

  it('revoca della condivisione mentre l\'invitato lavora: la richiesta successiva è 404', async () => {
    const voce = corpo(await anna.leggi(`${P}/voci/v1`))
    expect((await t.scrivi('DELETE', `${P}/eventi/ev/condivisioni/${anna.id}`)).statusCode).toBe(204)
    expect((await anna.scrivi('PUT', `${P}/voci/v1`, { ...voce, nome: 'Tardi' })).statusCode).toBe(404)
    expect((await anna.leggi(`${P}/eventi/ev/spesa`)).statusCode).toBe(404)
    expect(corpo(await anna.leggi(`${P}/eventi`)).map((e: { id: string }) => e.id)).toEqual(['ar'])
  })

  it('l\'invitato può lasciare l\'evento; non può revocare gli altri', async () => {
    expect((await anna.scrivi('DELETE', `${P}/eventi/ev/condivisioni/${bruno.id}`)).statusCode).toBe(403)
    expect((await bruno.scrivi('DELETE', `${P}/eventi/ev/condivisioni/${bruno.id}`)).statusCode).toBe(204)
    expect((await bruno.leggi(`${P}/eventi/ev`)).statusCode).toBe(404)
  })

  it('modifiche contemporanee alla spesa di due utenti: la seconda con la stessa versione riceve 409', async () => {
    const manuale = uno<{ versione: number }>(t.db, "SELECT versione FROM articoli_spesa WHERE id = 'm1'")!
    const base = { nome: 'Ghiaccio', quantitaTesto: '2 sacchi', repartoId: null, nota: '', stato: 'comprato', versione: manuale.versione }
    const [a, b] = await Promise.all([anna.scrivi('PUT', `${P}/spesa/manuali/m1`, base), t.scrivi('PUT', `${P}/spesa/manuali/m1`, { ...base, quantitaTesto: '3 sacchi' })])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('stile di stampa: l\'invitato in modifica lo salva, quello in lettura no', async () => {
    const stile = corpo(await bruno.leggi(`${P}/eventi/ev/stampa`))
    expect((await bruno.scrivi('PUT', `${P}/eventi/ev/stampa`, { opzioni: stile.opzioni, versione: 0 })).statusCode).toBe(403)
    expect((await anna.scrivi('PUT', `${P}/eventi/ev/stampa`, { opzioni: { ...stile.opzioni, nota: 'Buone feste' }, versione: 0 })).statusCode).toBe(200)
  })

  it('trasferimento di proprietà: le ricette collegate passano come copie, il vecchio proprietario resta in modifica', async () => {
    const ev = corpo(await t.leggi(`${P}/eventi/ev`))
    const r = await t.scrivi('POST', `${P}/eventi/ev/trasferisci`, { utenteId: anna.id, versione: ev.versione })
    expect(r.statusCode, r.body).toBe(200)
    expect(corpo(await anna.leggi(`${P}/eventi/ev/accesso`)).permesso).toBe('proprietario')
    expect(corpo(await t.leggi(`${P}/eventi/ev/accesso`)).permesso).toBe('modifica')
    const voce = corpo(await anna.leggi(`${P}/voci/v1`))
    expect(voce.piattoId).not.toBe('p-lasagne')
    const copia = corpo(await anna.leggi(`${P}/piatti/${voce.piattoId}`))
    expect(copia).toMatchObject({ nome: 'Lasagne', mio: true, origineAutore: 'Loris' })
    expect(copia.foto).toHaveLength(1)
    // L'originale resta di Loris, intatto.
    expect(corpo(await t.leggi(`${P}/piatti/p-lasagne`))).toMatchObject({ mio: true, versione: 1 })
  })
})

describe('ricette e foto', () => {
  it('ricetta privata: invisibile agli altri anche con l\'id; la lista non la mostra', async () => {
    for (const c of [anna, bruno, carla]) {
      expect((await c.leggi(`${P}/piatti/p-privato`)).statusCode).toBe(404)
      expect(corpo(await c.leggi(`${P}/piatti?q=segreta`))).toEqual([])
    }
  })

  it('ricetta collegata a un evento condiviso: leggibile (con le foto) dagli invitati, non da altri', async () => {
    for (const c of [anna, bruno]) {
      expect(corpo(await c.leggi(`${P}/piatti/p-lasagne`))).toMatchObject({ nome: 'Lasagne', mio: false, proprietario: { nome: 'Loris' } })
      expect((await c.leggi(`${P}/foto/f1`)).statusCode).toBe(200)
    }
    expect((await carla.leggi(`${P}/foto/f1`)).statusCode).toBe(404)
    expect((await carla.leggi(`${P}/piatti/p-lasagne/esporta`)).statusCode).toBe(404)
  })

  it('condivisione di una ricetta: lettura, copia indipendente con foto, revoca', async () => {
    await ok(t.scrivi('PUT', `${P}/piatti/p-privato/condivisioni`, { utenti: [carla.id] }))
    await ok(t.inietta({ method: 'POST', url: `${P}/piatti/p-privato/foto?id=f2`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: jpeg(2) }))
    const vista = corpo(await carla.leggi(`${P}/piatti/p-privato`))
    expect(vista).toMatchObject({ mio: false, condivisaCon: [] })
    expect(corpo(await carla.leggi(`${P}/piatti`)).map((p: { id: string }) => p.id)).toContain('p-privato')
    expect((await carla.scrivi('PUT', `${P}/piatti/p-privato`, { ...vista, nome: 'Rubata' })).statusCode).toBe(403)
    expect((await carla.scrivi('POST', `${P}/piatti/p-privato/condivisioni`, { utenti: [] })).statusCode).toBe(404)

    const copia = await carla.scrivi('POST', `${P}/piatti/p-privato/copia`, { id: 'copia-carla' })
    expect(copia.statusCode, copia.body).toBe(201)
    expect(corpo(copia)).toMatchObject({ id: 'copia-carla', mio: true, origineAutore: 'Loris', originePiattoId: 'p-privato' })
    const fotoCopia = corpo(copia).foto[0].id
    expect(fotoCopia).not.toBe('f2')

    // Revoca: l'originale torna invisibile, la copia (e la sua foto) restano di Carla.
    await ok(t.scrivi('PUT', `${P}/piatti/p-privato/condivisioni`, { utenti: [] }))
    expect((await carla.leggi(`${P}/piatti/p-privato`)).statusCode).toBe(404)
    expect((await carla.leggi(`${P}/foto/f2`)).statusCode).toBe(404)
    expect((await carla.leggi(`${P}/foto/${fotoCopia}`)).statusCode).toBe(200)
    // Modifiche ed eliminazione dell'originale non toccano la copia.
    const orig = corpo(await t.leggi(`${P}/piatti/p-privato`))
    await ok(t.scrivi('PUT', `${P}/piatti/p-privato`, { ...orig, nome: 'Cambiata' }))
    expect((await t.scrivi('DELETE', `${P}/piatti/p-privato?versione=${orig.versione + 1}`)).statusCode).toBe(204)
    expect(corpo(await carla.leggi(`${P}/piatti/copia-carla`)).nome).toBe('Ricetta segreta')
  })

  it('l\'invitato in modifica collega una sua ricetta: il proprietario dell\'evento ne riceve una copia', async () => {
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-anna', nome: 'Tiramisù di Anna', porzioniBase: 8, ingredienti: [] }))
    const ev = corpo(await anna.leggi(`${P}/eventi/ev`))
    const [voce] = await ok(anna.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-dolce', portataId: ev.portate[4].id, nome: 'Tiramisù', piattoId: 'p-anna' }] }))
    expect(voce.piattoId).not.toBe('p-anna')
    const copia = corpo(await t.leggi(`${P}/piatti/${voce.piattoId}`))
    expect(copia).toMatchObject({ mio: true, nome: 'Tiramisù di Anna', origineAutore: 'Anna' })
    // Collegare una ricetta privata di altri, anche conoscendone l'id: 404.
    expect((await anna.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-x', portataId: ev.portate[0].id, nome: 'X', piattoId: 'p-privato' }] })).statusCode).toBe(404)
    // Il vincolo regge anche nel database.
    expect(() => uno(t.db, "UPDATE voci_menu SET piatto_id = 'p-anna' WHERE id = 'v1'")).toThrow(/altro utente/)
  })

  it('le foto di altri non si modificano, eliminano né si caricano sulle loro ricette', async () => {
    expect((await anna.scrivi('PUT', `${P}/foto/f1`, { didascalia: 'x', principale: true, passo: null, versione: 1 })).statusCode).toBe(403)
    expect((await anna.scrivi('DELETE', `${P}/foto/f1?versione=1`)).statusCode).toBe(403)
    const carica = await t.app.inject({ method: 'POST', url: `${P}/piatti/p-lasagne/foto?id=f9`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: anna.cookie! }, payload: jpeg(3) })
    expect(carica.statusCode).toBe(403)
  })

  it('uso degli ingredienti: nomi solo delle proprie ricette', async () => {
    const ingrediente = corpo(await t.leggi(`${P}/ingredienti`))[0]
    const lasagne = corpo(await t.leggi(`${P}/piatti/p-lasagne`))
    await ok(t.scrivi('PUT', `${P}/piatti/p-lasagne`, { ...lasagne, ingredienti: [{ id: 'i1', ordine: 0, testoOriginale: 'x', nome: ingrediente.nome, ingredienteId: ingrediente.id, quantita: 1, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] }] }))
    expect(corpo(await carla.leggi(`${P}/ingredienti/${ingrediente.id}/usi`))).toEqual({ piatti: [], altri: 1 })
    expect(corpo(await t.leggi(`${P}/ingredienti/${ingrediente.id}/usi`)).piatti).toEqual([{ id: 'p-lasagne', nome: 'Lasagne' }])
    // Eliminare dal catalogo: solo l'amministratore.
    expect((await carla.scrivi('DELETE', `${P}/ingredienti/${ingrediente.id}?versione=1`)).statusCode).toBe(403)
  })
})

describe('esportazioni', () => {
  it('«i miei dati» contiene solo eventi e ricette dell\'utente', async () => {
    await nuovoEvento(carla, 'ev-carla', 'Compleanno di Carla')
    await ok(carla.scrivi('POST', `${P}/piatti`, { id: 'p-carla', nome: 'Torta di Carla', ingredienti: [] }))
    const r = await carla.leggi(`${P}/account/esportazione`)
    expect(r.statusCode).toBe(200)
    const zip = unzipSync(new Uint8Array(r.rawPayload))
    const dati = JSON.parse(strFromU8(zip['dati.json']!))
    expect(dati.eventi.map((e: { evento: { id: string } }) => e.evento.id)).toEqual(['ev-carla'])
    expect(dati.ricette.map((x: { nome: string }) => x.nome)).toEqual(['Torta di Carla'])
    expect(JSON.stringify(dati)).not.toMatch(/Lasagne|Pasqua|segreta|Ghiaccio|Ragù/)
    // Anche Anna (invitata in modifica) esporta solo ciò che è suo.
    const perAnna = JSON.parse(strFromU8(unzipSync(new Uint8Array((await anna.leggi(`${P}/account/esportazione`)).rawPayload))['dati.json']!))
    expect(perAnna.eventi).toEqual([])
  })
})
