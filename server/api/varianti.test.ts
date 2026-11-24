// Varianti delle ricette nelle voci del menù (SPEC §44): ingredienti adattati per un evento, copiati
// nella voce e indipendenti dalla ricetta; «Usa una versione precedente» con permessi e archivio.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ID_AMMINISTRATORE } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
let bruno: ClientDiProva & { id: string }
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const ing = (id: string, nome: string, quantita: number | null = 100, unita: string | null = 'g') => ({
  id, ordine: 0, testoOriginale: `${quantita ?? ''} ${unita ?? ''} ${nome}`.trim(), nome, ingredienteId: null, quantita, quantitaMax: null, unita,
  scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [],
})
const RICOTTA = {
  descrizione: 'ricotta e sesamo',
  nota: 'Ricotta ben scolata; niente frullatore.',
  porzioniBase: 4,
  ingredienti: [ing('a', 'ricotta', 250), ing('b', 'sesamo', 40), ing('c', 'erba cipollina', 10), ing('d', 'spaghetti', 20)],
}
const evento = (c: ClientDiProva, id: string, nome: string, data: string) =>
  ok(c.scrivi('POST', `${P}/eventi`, { id, nome, data, oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '', gruppoId: G }))
const voce = async (c: ClientDiProva, eventoId: string, voceId: string, piattoId: string) => {
  const e = corpo(await c.leggi(`${P}/eventi/${eventoId}`))
  const menu = corpo(await c.leggi(`${P}/eventi/${eventoId}/menu`))
  await ok(c.scrivi('POST', `${P}/eventi/${e.id}/voci`, { voci: [{ id: voceId, portataId: menu.portate[0].id, nome: 'Finte palline di Natale', piattoId }] }))
  return corpo(await c.leggi(`${P}/voci/${voceId}`))
}
const adatta = (c: ClientDiProva, voceId: string, versione: number, variante: unknown = RICOTTA) => c.scrivi('PUT', `${P}/voci/${voceId}/variante`, { variante, versione })
const nomiSpesa = async (eventoId: string) => (corpo(await t.leggi(`${P}/eventi/${eventoId}/spesa`)).voci as { nome: string }[]).map((v) => v.nome).sort()
const precedenti = async (c: ClientDiProva, voceId: string) => corpo(await c.leggi(`${P}/voci/${voceId}/varianti`)) as { voceId: string; eventoNome: string; data: string; archiviato: boolean; variante: { descrizione: string; ingredienti: { nome: string }[] } }[]

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  await ok(t.scrivi('POST', `${P}/piatti`, {
    id: 'palline', nome: 'Finte palline di Natale', porzioniBase: 6, famiglie: [G],
    ingredienti: [ing('m', 'mortadella', 300), ing('p', 'pistacchi', 60), ing('s', 'spaghetti', 20)],
    procedimento: ['Frullate la mortadella', 'Formate le palline'],
  }))
  await evento(t, 'pasqua', 'Pasqua 2027', '2027-03-28')
})
afterEach(() => t.chiudi())

describe('adattare gli ingredienti di una voce', () => {
  it('copia completa nella voce: spesa dagli ingredienti della variante, ricetta invariata, ricetta d\'origine dal server', async () => {
    const v = await voce(t, 'pasqua', 'v1', 'palline')
    expect(v.variante).toBeNull()
    const salvata = await ok(adatta(t, 'v1', v.versione))
    expect(salvata.variante).toMatchObject({ ricettaOrigine: 'palline', descrizione: 'ricotta e sesamo', porzioniBase: 4 })
    expect(salvata.variante.ingredienti.map((i: { ordine: number }) => i.ordine)).toEqual([0, 1, 2, 3])
    expect(await nomiSpesa('pasqua')).toEqual(['erba cipollina', 'ricotta', 'sesamo', 'spaghetti'])
    // 250 g per 4 → per 8 coperti 500 g
    expect(corpo(await t.leggi(`${P}/eventi/pasqua/spesa`)).voci.find((x: { nome: string }) => x.nome === 'ricotta').quantita).toBe(500)
    const ricetta = corpo(await t.leggi(`${P}/piatti/palline`))
    expect(ricetta.ingredienti.map((i: { nome: string }) => i.nome)).toEqual(['mortadella', 'pistacchi', 'spaghetti'])
    expect(ricetta.versione).toBe(1)
    // «Torna alla ricetta»
    await ok(adatta(t, 'v1', salvata.versione, null))
    expect(await nomiSpesa('pasqua')).toEqual(['mortadella', 'pistacchi', 'spaghetti'])
  })

  it('versione, permessi, regole', async () => {
    const v = await voce(t, 'pasqua', 'v1', 'palline')
    await ok(t.scrivi('PUT', `${P}/eventi/pasqua/condivisioni/${bruno.id}`, { permesso: 'lettura' }))
    expect((await adatta(bruno, 'v1', v.versione)).statusCode).toBe(403)
    expect((await bruno.leggi(`${P}/voci/v1/varianti`)).statusCode).toBe(200)
    expect((await adatta(anna, 'v1', v.versione)).statusCode).toBe(404)
    expect((await adatta(t, 'v1', v.versione + 5)).statusCode).toBe(409)
    expect((await adatta(t, 'v1', v.versione, { ...RICOTTA, ingredienti: [] })).statusCode).toBe(400)
    expect((await adatta(t, 'v1', v.versione, { ...RICOTTA, ingredienti: [ing('x', 'a'), ing('x', 'b')] })).statusCode).toBe(400)
    // Senza ricetta non si adatta nulla.
    const menu = corpo(await t.leggi(`${P}/eventi/pasqua/menu`))
    await ok(t.scrivi('POST', `${P}/eventi/pasqua/voci`, { voci: [{ id: 'libera', portataId: menu.portate[0].id, nome: 'Crostini' }] }))
    expect((await adatta(t, 'libera', 1)).statusCode).toBe(422)
    // Chi legge l'evento vede la variante (Cucina).
    await ok(adatta(t, 'v1', v.versione))
    expect(corpo(await bruno.leggi(`${P}/eventi/pasqua/menu`)).portate[0].voci[0].variante.nota).toBe('Ricotta ben scolata; niente frullatore.')
  })

  it('un\'altra ricetta, o nessuna, fa decadere la variante; la ricetta eliminata anche', async () => {
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'altra', nome: 'Altra', porzioniBase: 4, ingredienti: [ing('z', 'zucca')] }))
    let v = await voce(t, 'pasqua', 'v1', 'palline')
    v = await ok(adatta(t, 'v1', v.versione))
    const dati = { nome: v.nome, porzioni: null, incaricato: '', inSpesa: true, note: '' }
    // Stessa ricetta: resta.
    v = await ok(t.scrivi('PUT', `${P}/voci/v1`, { ...dati, nome: 'Palline', piattoId: 'palline', versione: v.versione }))
    expect(v.variante).not.toBeNull()
    v = await ok(t.scrivi('PUT', `${P}/voci/v1`, { ...dati, piattoId: 'altra', versione: v.versione }))
    expect(v.variante).toBeNull()
    v = await ok(t.scrivi('PUT', `${P}/voci/v1`, { ...dati, piattoId: 'palline', versione: v.versione }))
    expect(v.variante).toBeNull()
    v = await ok(adatta(t, 'v1', v.versione))
    await ok(t.scrivi('DELETE', `${P}/piatti/palline?versione=1`))
    expect(corpo(await t.leggi(`${P}/voci/v1`))).toMatchObject({ piattoId: null, variante: null })
  })

  it('«Annulla» dopo l\'eliminazione rimette anche la variante', async () => {
    let v = await voce(t, 'pasqua', 'v1', 'palline')
    v = await ok(adatta(t, 'v1', v.versione))
    await ok(t.scrivi('DELETE', `${P}/voci/v1?versione=${v.versione}`))
    await ok(t.scrivi('POST', `${P}/eventi/pasqua/voci`, { voci: [{ id: 'v1', portataId: v.portataId, nome: v.nome, piattoId: v.piattoId, variante: v.variante }] }))
    expect(corpo(await t.leggi(`${P}/voci/v1`)).variante).toMatchObject({ descrizione: 'ricotta e sesamo', ricettaOrigine: 'palline' })
  })

  it('evento archiviato: nessuna modifica', async () => {
    const v = await voce(t, 'pasqua', 'v1', 'palline')
    const e = corpo(await t.leggi(`${P}/eventi/pasqua`))
    await ok(t.scrivi('POST', `${P}/eventi/pasqua/archivia`, { versione: e.versione }))
    const r = await adatta(t, 'v1', v.versione)
    expect(r.statusCode).toBe(422)
    expect(corpo(r).errore.dettagli.regola).toBe('evento_archiviato')
  })
})

describe('«Usa una versione precedente»', () => {
  it('varianti della stessa ricetta in altri eventi visibili, dalla più recente; la voce attuale esclusa; nome dell\'evento solo per riconoscerla', async () => {
    let v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    await ok(adatta(t, 'v-pasqua', v.versione))
    // Due eventi con lo stesso nome: due varianti distinte (l'identità è la voce, non il nome).
    await evento(t, 'n26', 'Natale', '2026-12-25')
    v = await voce(t, 'n26', 'v-n26', 'palline')
    await ok(adatta(t, 'v-n26', v.versione, { ...RICOTTA, descrizione: 'tonno', ingredienti: [ing('t', 'tonno', 200)] }))
    await evento(t, 'n25', 'Natale', '2025-12-25')
    v = await voce(t, 'n25', 'v-n25', 'palline')
    await ok(adatta(t, 'v-n25', v.versione, { ...RICOTTA, descrizione: 'tonno', ingredienti: [ing('t', 'tonno', 200)] }))
    // Voce senza variante: non compare.
    await evento(t, 'n27', 'Natale 2027', '2027-12-25')
    await voce(t, 'n27', 'v-n27', 'palline')
    const elenco = await precedenti(t, 'v-n27')
    expect(elenco.map((x) => [x.voceId, x.eventoNome, x.data])).toEqual([
      ['v-pasqua', 'Pasqua 2027', '2027-03-28'],
      ['v-n26', 'Natale', '2026-12-25'],
      ['v-n25', 'Natale', '2025-12-25'],
    ])
    expect((await precedenti(t, 'v-pasqua')).map((x) => x.voceId)).toEqual(['v-n26', 'v-n25'])
  })

  it('riusata, la variante è una copia: cambiarla non tocca l\'evento da cui viene', async () => {
    let v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    await ok(adatta(t, 'v-pasqua', v.versione))
    await evento(t, 'n27', 'Natale 2027', '2027-12-25')
    v = await voce(t, 'n27', 'v-n27', 'palline')
    const [scelta] = await precedenti(t, 'v-n27')
    v = await ok(adatta(t, 'v-n27', v.versione, scelta!.variante))
    expect(v.variante).toMatchObject({ descrizione: 'ricotta e sesamo', nota: 'Ricotta ben scolata; niente frullatore.' })
    await ok(adatta(t, 'v-n27', v.versione, { ...RICOTTA, ingredienti: [ing('a', 'ricotta', 300)] }))
    const pasqua = corpo(await t.leggi(`${P}/voci/v-pasqua`))
    expect(pasqua.variante.ingredienti.map((i: { nome: string }) => i.nome)).toEqual(['ricotta', 'sesamo', 'erba cipollina', 'spaghetti'])
  })

  it('solo eventi visibili; le copie della stessa ricetta contano', async () => {
    // Anna usa la ricetta di famiglia nel suo evento: la voce punta alla sua copia (stessa origine).
    await evento(anna, 'compleanno', 'Compleanno di Anna', '2027-05-10')
    let v = await voce(anna, 'compleanno', 'v-anna', 'palline')
    expect(v.piattoId).not.toBe('palline')
    await ok(adatta(anna, 'v-anna', v.versione, { ...RICOTTA, descrizione: 'prosciutto' }))
    v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    expect(await precedenti(t, 'v-pasqua')).toEqual([])
    await ok(anna.scrivi('PUT', `${P}/eventi/compleanno/condivisioni/${ID_AMMINISTRATORE}`, { permesso: 'lettura' }))
    expect((await precedenti(t, 'v-pasqua')).map((x) => [x.voceId, x.variante.descrizione])).toEqual([['v-anna', 'prosciutto']])
  })

  it('evento archiviato: la variante conservata nell\'archivio, anche dopo aver cambiato o eliminato la ricetta', async () => {
    let v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    v = await ok(adatta(t, 'v-pasqua', v.versione))
    const e = corpo(await t.leggi(`${P}/eventi/pasqua`))
    await ok(t.scrivi('POST', `${P}/eventi/pasqua/archivia`, { versione: e.versione }))
    // Anche se la voce viva cambiasse, vale l'archivio.
    esegui(t.db, "UPDATE voci_menu SET variante = json_set(variante, '$.descrizione', 'alterata') WHERE id = 'v-pasqua'")
    await evento(t, 'n27', 'Natale 2027', '2027-12-25')
    await voce(t, 'n27', 'v-n27', 'palline')
    let elenco = await precedenti(t, 'v-n27')
    expect(elenco).toHaveLength(1)
    expect(elenco[0]).toMatchObject({ voceId: 'v-pasqua', archiviato: true, variante: { descrizione: 'ricotta e sesamo' } })
    // La ricetta cambia: l'archivio no.
    const r = corpo(await t.leggi(`${P}/piatti/palline`))
    await ok(t.scrivi('PUT', `${P}/piatti/palline`, { ...r, ingredienti: [ing('m', 'salame', 500)], versione: r.versione }))
    elenco = await precedenti(t, 'v-n27')
    expect(elenco[0]!.variante.ingredienti.map((i) => i.nome)).toEqual(['ricotta', 'sesamo', 'erba cipollina', 'spaghetti'])
  })

  it('al più 20, dalla più recente', async () => {
    for (let i = 0; i < 22; i++) {
      const id = `e${i}`
      await evento(t, id, `Evento ${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`)
      const v = await voce(t, id, `v${i}`, 'palline')
      await ok(adatta(t, `v${i}`, v.versione))
    }
    const v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    const elenco = await precedenti(t, v.id)
    expect(elenco).toHaveLength(20)
    expect(elenco[0]!.eventoNome).toBe('Evento 21')
    expect(elenco[19]!.eventoNome).toBe('Evento 2')
  })
})

describe('archivio, duplicazione, esportazione', () => {
  it('lo snapshot conserva la variante; la duplicazione la copia con la voce', async () => {
    let v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    v = await ok(adatta(t, 'v-pasqua', v.versione))
    const e = corpo(await t.leggi(`${P}/eventi/pasqua`))
    await ok(t.scrivi('POST', `${P}/eventi/pasqua/archivia`, { versione: e.versione }))
    const snap = corpo(await t.leggi(`${P}/eventi/pasqua/snapshot`))
    const valido = (Array.isArray(snap) ? snap : [snap]).find((s: { stato: string }) => s.stato === 'valido')
    expect(valido.contenuto.menu[0].voci[0].variante).toMatchObject({ descrizione: 'ricotta e sesamo' })
    const esito = await ok(t.scrivi('POST', `${P}/eventi/pasqua/duplica`, { id: 'pasqua28', nome: 'Pasqua 2028', data: '2028-04-16', copia: { menu: true } }))
    expect(esito.evento.id).toBe('pasqua28')
    const copia = corpo(await t.leggi(`${P}/eventi/pasqua28/menu`)).portate[0].voci[0]
    expect(copia.variante).toMatchObject({ descrizione: 'ricotta e sesamo', ricettaOrigine: 'palline' })
    expect(await nomiSpesa('pasqua28')).toEqual(['erba cipollina', 'ricotta', 'sesamo', 'spaghetti'])
  })

  it('esportazione e ripristino conservano la variante', async () => {
    let v = await voce(t, 'pasqua', 'v-pasqua', 'palline')
    v = await ok(adatta(t, 'v-pasqua', v.versione))
    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    await ok(adatta(t, 'v-pasqua', v.versione, null))
    const ver = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: ver.token, conferma: 'RIPRISTINA' }))
    expect(corpo(await t.leggi(`${P}/voci/v-pasqua`)).variante).toMatchObject({ descrizione: 'ricotta e sesamo' })
  })
})
