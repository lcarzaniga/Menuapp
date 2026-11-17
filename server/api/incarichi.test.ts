// Chi porta cosa e valutazioni (SPEC §20.5, §20.7).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // lettura (partecipa)
let bruno: ClientDiProva & { id: string } // modifica
let carla: ClientDiProva & { id: string } // nessun accesso
const P = '/api/v1'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const ingrediente = (nome: string) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `100 g ${nome}`, nome, ingredienteId: null, quantita: 100, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const elenco = async (c: ClientDiProva, ev = 'ev') => corpo(await c.leggi(`${P}/eventi/${ev}/incarichi`))
const voce = async (c: ClientDiProva, id: string) => (await elenco(c)).incarichi.find((x: { id: string }) => x.id === id)

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  carla = t.utente('Carla')
  const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 0, note: '' }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-tiramisu', nome: 'Tiramisù', porzioniBase: 8, ingredienti: [ingrediente('mascarpone')] }))
  await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-tiramisu', portataId: ev.portate[4].id, nome: 'Tiramisù', piattoId: 'p-tiramisu' }, { id: 'v-crostini', portataId: ev.portate[0].id, nome: 'Crostini' }] }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
})
afterEach(() => t.chiudi())

describe('chi porta cosa', () => {
  it('elenco: piatti del menù e cose da portare, con stato e responsabile', async () => {
    await ok(anna.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-vino', nome: 'Vino rosso', quantita: '3 bottiglie', prendo: true }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-pane', nome: 'Pane' }))
    const e = await elenco(anna)
    expect(e).toMatchObject({ puoPartecipare: true, puoAssegnare: false })
    expect(e.incarichi.map((x: { tipo: string; nome: string; stato: string; incaricato: string }) => [x.tipo, x.nome, x.stato, x.incaricato])).toEqual([
      ['voce', 'Crostini', 'da_assegnare', ''],
      ['voce', 'Tiramisù', 'da_assegnare', ''],
      ['cosa', 'Vino rosso', 'assegnato', 'Anna'],
      ['cosa', 'Pane', 'da_assegnare', ''],
    ])
    expect(e.persone.map((p: { nome: string }) => p.nome).sort()).toEqual(['Anna', 'Bruno', 'Loris'])
    expect((await carla.leggi(`${P}/eventi/ev/incarichi`)).statusCode).toBe(404)
  })

  it('mi offro per un piatto del menù: «A cura di» si aggiorna e, se lo porto io, esce dalla spesa; alla rinuncia torna', async () => {
    expect(JSON.stringify(corpo(await t.leggi(`${P}/eventi/ev/spesa`)))).toContain('mascarpone')
    const v = await voce(anna, 'v-tiramisu')
    const preso = await ok(anna.scrivi('POST', `${P}/voci/v-tiramisu/prendi`, { versione: v.versione, togliDallaSpesa: true }))
    expect(preso).toMatchObject({ incaricato: 'Anna', incaricatoId: anna.id, stato: 'assegnato', inSpesa: false, spesaToltaDaIncarico: true })
    // Lo stesso modello del menù: la voce mostra «A cura di Anna» ed esce dalla spesa.
    const voceMenu = corpo(await t.leggi(`${P}/voci/v-tiramisu`))
    expect(voceMenu).toMatchObject({ incaricato: 'Anna', inSpesa: false })
    expect(JSON.stringify(corpo(await t.leggi(`${P}/eventi/ev/spesa`)))).not.toContain('mascarpone')
    const notifica = corpo(await t.leggi(`${P}/notifiche`)).find((n: { tipo: string }) => n.tipo === 'incarico')
    expect(notifica).toMatchObject({ testo: 'Anna porta «Tiramisù»', collegamento: '/eventi/ev/chi-porta?incarico=voce%3Av-tiramisu' })

    const lasciato = await ok(anna.scrivi('POST', `${P}/voci/v-tiramisu/rinuncia`, { versione: preso.versione }))
    expect(lasciato).toMatchObject({ incaricato: '', stato: 'da_assegnare', inSpesa: true, spesaToltaDaIncarico: false })
    expect(JSON.stringify(corpo(await t.leggi(`${P}/eventi/ev/spesa`)))).toContain('mascarpone')
  })

  it('la rinuncia non rimette nella spesa una voce che ne era già fuori per scelta dell\'organizzatore', async () => {
    const vm = corpo(await t.leggi(`${P}/voci/v-tiramisu`))
    await ok(t.scrivi('PUT', `${P}/voci/v-tiramisu`, { ...vm, inSpesa: false }))
    const v = await voce(anna, 'v-tiramisu')
    const preso = await ok(anna.scrivi('POST', `${P}/voci/v-tiramisu/prendi`, { versione: v.versione, togliDallaSpesa: true }))
    expect(preso.spesaToltaDaIncarico).toBe(false)
    const lasciato = await ok(anna.scrivi('POST', `${P}/voci/v-tiramisu/rinuncia`, { versione: preso.versione }))
    expect(lasciato.inSpesa).toBe(false)
  })

  it('due persone si offrono insieme: una sola ce la fa, l\'altra riceve 409 con chi l\'ha preso', async () => {
    const v = await voce(anna, 'v-crostini')
    const [a, b] = await Promise.all([anna.scrivi('POST', `${P}/voci/v-crostini/prendi`, { versione: v.versione }), bruno.scrivi('POST', `${P}/voci/v-crostini/prendi`, { versione: v.versione })])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    const perso = a.statusCode === 409 ? a : b
    expect(corpo(perso).errore.dettagli.attuale.stato).toBe('assegnato')
    // Anche con la versione aggiornata non si toglie a un altro.
    const attuale = await voce(carla === anna ? anna : bruno, 'v-crostini')
    const vincitore = attuale.incaricatoId === anna.id ? bruno : anna
    expect((await vincitore.scrivi('POST', `${P}/voci/v-crostini/prendi`, { versione: attuale.versione })).statusCode).toBe(409)
  })

  it('permessi: chi legge si offre (salvo esclusione), solo chi organizza assegna e libera gli altri', async () => {
    const v = await voce(anna, 'v-crostini')
    expect((await anna.scrivi('POST', `${P}/voci/v-crostini/assegna`, { versione: v.versione, utenteId: anna.id })).statusCode).toBe(403)
    expect((await carla.scrivi('POST', `${P}/voci/v-crostini/prendi`, { versione: v.versione })).statusCode).toBe(404)
    const assegnato = await ok(bruno.scrivi('POST', `${P}/voci/v-crostini/assegna`, { versione: v.versione, utenteId: anna.id }))
    expect(assegnato.incaricato).toBe('Anna')
    expect(corpo(await anna.leggi(`${P}/notifiche`)).map((n: { testo: string }) => n.testo)).toContain('Ti è stato affidato «Crostini»')
    expect((await bruno.scrivi('POST', `${P}/voci/v-crostini/assegna`, { versione: assegnato.versione, utenteId: carla.id })).statusCode).toBe(404)
    // Anna lo segna come fatto; Bruno (organizzatore) lo può liberare.
    const fatto = await ok(anna.scrivi('POST', `${P}/voci/v-crostini/completa`, { versione: assegnato.versione, completato: true }))
    expect(fatto.stato).toBe('completato')
    await ok(bruno.scrivi('POST', `${P}/voci/v-crostini/rinuncia`, { versione: fatto.versione }))
    // Esclusa dalla partecipazione: legge ma non si offre.
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura', partecipa: false }))
    const ora = await voce(anna, 'v-crostini')
    expect(ora.puoPrendere).toBe(false)
    expect((await anna.scrivi('POST', `${P}/voci/v-crostini/prendi`, { versione: ora.versione })).statusCode).toBe(403)
  })

  it('«A cura di» scritto a mano a un altro nome scollega l\'utente; evento archiviato: niente incarichi', async () => {
    const v = await voce(anna, 'v-crostini')
    await ok(anna.scrivi('POST', `${P}/voci/v-crostini/prendi`, { versione: v.versione }))
    const vm = corpo(await t.leggi(`${P}/voci/v-crostini`))
    await ok(t.scrivi('PUT', `${P}/voci/v-crostini`, { ...vm, incaricato: 'Zia Pina' }))
    expect(await voce(anna, 'v-crostini')).toMatchObject({ incaricato: 'Zia Pina', incaricatoId: null, stato: 'assegnato', puoRinunciare: false })
    const ev = corpo(await t.leggi(`${P}/eventi/ev`))
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: ev.versione }))
    const dopo = await voce(anna, 'v-tiramisu')
    expect(dopo.puoPrendere).toBe(false)
    expect((await anna.scrivi('POST', `${P}/voci/v-tiramisu/prendi`, { versione: dopo.versione })).statusCode).toBe(422)
  })

  it('cose da portare: le modifica chi le ha aggiunte o chi organizza', async () => {
    const c = await ok(anna.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-ghiaccio', nome: 'Ghiaccio' }))
    expect((await t.utente('Carla').scrivi('PUT', `${P}/cose/c-ghiaccio`, { nome: 'x', quantita: '', note: '', versione: c.versione })).statusCode).toBe(404)
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${carla.id}`, { permesso: 'lettura' }))
    expect((await carla.scrivi('PUT', `${P}/cose/c-ghiaccio`, { nome: 'x', quantita: '', note: '', versione: c.versione })).statusCode).toBe(403)
    const mod = await ok(anna.scrivi('PUT', `${P}/cose/c-ghiaccio`, { nome: 'Ghiaccio', quantita: '2 sacchi', note: 'in freezer', versione: c.versione }))
    expect(mod.quantita).toBe('2 sacchi')
    const preso = await ok(carla.scrivi('POST', `${P}/cose/c-ghiaccio/prendi`, { versione: mod.versione }))
    expect(preso.incaricato).toBe('Carla')
    expect((await bruno.scrivi('DELETE', `${P}/cose/c-ghiaccio?versione=${preso.versione}`)).statusCode).toBe(204)
    expect(uno(t.db, 'SELECT count(*) AS n FROM cose_da_portare')).toEqual({ n: 0 })
  })
})

describe('valutazioni e classifica', () => {
  const passato = () => esegui(t.db, "UPDATE eventi SET data = '2026-01-01'")

  it('si vota dopo l\'evento, un voto per utente (anche da più dispositivi), modificabile', async () => {
    expect((await anna.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 5 })).statusCode).toBe(422)
    passato()
    await ok(anna.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 5 }))
    await ok(t.sessione(anna.id).scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 3 }))
    const r = await ok(bruno.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 4 }))
    expect(r.voci).toEqual([{ voceId: 'v-tiramisu', media: 3.5, numero: 2, mie: 4 }])
    expect((await anna.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 6 })).statusCode).toBe(400)
    expect((await carla.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 5 })).statusCode).toBe(404)
    expect(uno(t.db, 'SELECT count(*) AS n FROM valutazioni')).toEqual({ n: 2 })
  })

  it('le valutazioni restano dopo archiviazione, modifica ed eliminazione della ricetta e della voce', async () => {
    passato()
    await ok(anna.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 5 }))
    const ev = corpo(await t.leggi(`${P}/eventi/ev`))
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: ev.versione }))
    expect(corpo(await anna.leggi(`${P}/eventi/ev/valutazioni`)).voci[0]).toMatchObject({ media: 5, numero: 1 })
    await ok(anna.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 4 }))
    const p = corpo(await t.leggi(`${P}/piatti/p-tiramisu`))
    await ok(t.scrivi('PUT', `${P}/piatti/p-tiramisu`, { ...p, nome: 'Tiramisù rivisto' }))
    expect((await t.scrivi('DELETE', `${P}/piatti/p-tiramisu?versione=${p.versione + 1}`)).statusCode).toBe(204)
    const c = corpo(await anna.leggi(`${P}/classifica`))
    expect(c).toEqual([expect.objectContaining({ nome: 'Tiramisù', media: 4, numero: 1, ricettaId: null })])
  })

  it('classifica: media ponderata, preparazioni della stessa ricetta sommate, piatti senza ricetta non fusi per nome', async () => {
    passato()
    // Secondo evento: il tiramisù è una copia nel ricettario di Bruno (stessa origine).
    const ev2 = await ok(bruno.scrivi('POST', `${P}/eventi`, { id: 'ev2', nome: 'Capodanno', data: '2026-01-01', oraServizio: null, tipo: 'cena', occasione: '', adulti: 4, bambini: 0, note: '' }))
    const copia = await ok(bruno.scrivi('POST', `${P}/piatti/p-tiramisu/copia`, { id: 'p-copia' }))
    await ok(bruno.scrivi('POST', `${P}/eventi/ev2/voci`, { voci: [{ id: 'v2-tiramisu', portataId: ev2.portate[4].id, nome: 'Tiramisù', piattoId: copia.id }, { id: 'v2-crostini', portataId: ev2.portate[0].id, nome: 'Crostini' }] }))
    for (const c of [anna, bruno, t]) await ok(c.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 4 }))
    await ok(bruno.scrivi('PUT', `${P}/voci/v2-tiramisu/valutazione`, { stelle: 5 }))
    // Un solo voto da 5 per i crostini del primo evento.
    await ok(anna.scrivi('PUT', `${P}/voci/v-crostini/valutazione`, { stelle: 5 }))
    await ok(bruno.scrivi('PUT', `${P}/voci/v2-crostini/valutazione`, { stelle: 2 }))
    const c = corpo(await bruno.leggi(`${P}/classifica`))
    expect(c.map((x: { nome: string; media: number; numero: number; eventi: number }) => [x.nome, x.media, x.numero, x.eventi])).toEqual([
      ['Tiramisù', 4.3, 4, 2],
      ['Crostini', 5, 1, 1],
      ['Crostini', 2, 1, 1],
    ])
    expect(c[0].punteggio).toBeGreaterThan(c[1].punteggio)
    expect(c[0].ricettaId).toBe('p-tiramisu')
    // Filtri: portata e anno.
    expect(corpo(await bruno.leggi(`${P}/classifica?portata=Dolci`)).map((x: { nome: string }) => x.nome)).toEqual(['Tiramisù'])
    expect(corpo(await bruno.leggi(`${P}/classifica?anno=2025`))).toEqual([])
    // Chi non vede l'evento di Bruno non ne conta i voti.
    expect(corpo(await anna.leggi(`${P}/classifica`)).map((x: { numero: number }) => x.numero)).toEqual([3, 1])
    expect(corpo(await carla.leggi(`${P}/classifica`))).toEqual([])
  })

  it('chi ha preparato il piatto viene avvisato delle nuove stelle', async () => {
    const v = await voce(anna, 'v-tiramisu')
    await ok(anna.scrivi('POST', `${P}/voci/v-tiramisu/prendi`, { versione: v.versione }))
    passato()
    await ok(bruno.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 5 }))
    await ok(t.scrivi('PUT', `${P}/voci/v-tiramisu/valutazione`, { stelle: 4 }))
    const n = corpo(await anna.leggi(`${P}/notifiche`)).filter((x: { tipo: string }) => x.tipo === 'valutazione')
    expect(n).toEqual([expect.objectContaining({ conteggio: 2, testo: 'Nuove stelle per «Tiramisù»' })])
  })
})
