import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaDettaglioPiatto, SchemaIngrediente, SchemaRiepilogoPiatto } from '../../src/contratto/ricettario.ts'
import { uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())
const corpo = (r: { body: string }) => JSON.parse(r.body)

const ing = (id: string, nome: string, extra: Record<string, unknown> = {}) => ({
  id, ordine: 0, testoOriginale: nome, nome, ingredienteId: null, quantita: null, quantitaMax: null, unita: null,
  scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [], ...extra,
})

async function lasagne() {
  const r = await t.scrivi('POST', '/api/v1/piatti', {
    id: 'p-lasagne',
    nome: 'Lasagne alla bolognese',
    porzioniBase: 6,
    procedimento: ['Preparare il ragù', 'Montare gli strati'],
    ingredienti: [
      ing('i1', 'lasagne', { quantita: 500, unita: 'g', ingredienteId: 'ing-lasagne' }),
      ing('i2', 'burro', { quantita: 50, unita: 'g', ingredienteId: 'ing-burro' }),
    ],
  })
  expect(r.statusCode, r.body).toBe(201)
  return SchemaDettaglioPiatto.parse(corpo(r))
}

describe('piatti', () => {
  it('creazione con ingredienti, elenco e ricerca', async () => {
    const p = await lasagne()
    expect(p.ingredienti.map((i) => i.nome)).toEqual(['lasagne', 'burro'])
    const elenco = corpo(await t.leggi('/api/v1/piatti?q=lasag')).map((x: unknown) => SchemaRiepilogoPiatto.parse(x))
    expect(elenco).toHaveLength(1)
    expect(elenco[0]).toMatchObject({ numeroIngredienti: 2, usi: 0 })
    expect(corpo(await t.leggi('/api/v1/piatti?q=zuppa'))).toEqual([])
  })

  it('modifica dell\'aggregato: ingredienti sostituiti, versione e conflitto', async () => {
    const p = await lasagne()
    const nuovo = { ...p, nome: 'Lasagne', ingredienti: [ing('i3', 'besciamella', { statoParsing: 'da_verificare', problemiParsing: ['Quantità non indicata'] })] }
    const r = await t.scrivi('PUT', '/api/v1/piatti/p-lasagne', nuovo)
    expect(r.statusCode, r.body).toBe(200)
    expect(SchemaDettaglioPiatto.parse(corpo(r)).ingredienti.map((i) => i.nome)).toEqual(['besciamella'])
    expect((await t.scrivi('PUT', '/api/v1/piatti/p-lasagne', nuovo)).statusCode).toBe(409)
  })

  it('validazioni: q.b. con quantità, intervallo rovesciato, ingrediente di catalogo inesistente', async () => {
    const base = { id: 'x', nome: 'X' }
    expect((await t.scrivi('POST', '/api/v1/piatti', { ...base, ingredienti: [ing('a', 'sale', { unita: 'qb', quantita: 2 })] })).statusCode).toBe(400)
    expect((await t.scrivi('POST', '/api/v1/piatti', { ...base, ingredienti: [ing('a', 'patate', { quantita: 3, quantitaMax: 2 })] })).statusCode).toBe(400)
    expect((await t.scrivi('POST', '/api/v1/piatti', { ...base, ingredienti: [ing('a', 'x', { ingredienteId: 'ing-nessuno' })] })).statusCode).toBe(422)
    expect((await t.scrivi('POST', '/api/v1/piatti', { ...base, porzioniBase: 0 })).statusCode).toBe(400)
  })

  it('«Crea nel ricettario» da una voce e uso del piatto', async () => {
    await t.scrivi('POST', '/api/v1/eventi', { id: 'e', nome: 'Natale', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '' })
    const ev = corpo(await t.leggi('/api/v1/eventi/e'))
    const [voce] = corpo(await t.scrivi('POST', '/api/v1/eventi/e/voci', { voci: [{ id: 'v', portataId: ev.portate[1].id, nome: 'Tortellini in brodo' }] }))
    const r = await t.scrivi('POST', '/api/v1/voci/v/crea-piatto', { piattoId: 'p-tort', versione: voce.versione })
    expect(r.statusCode, r.body).toBe(201)
    expect(corpo(r)).toMatchObject({ voce: { piattoId: 'p-tort', versione: 2 }, piatto: { nome: 'Tortellini in brodo', porzioniBase: null } })
    expect((await t.scrivi('POST', '/api/v1/voci/v/crea-piatto', { piattoId: 'p-altro', versione: 2 })).statusCode).toBe(422)
    const dettaglio = SchemaDettaglioPiatto.parse(corpo(await t.leggi('/api/v1/piatti/p-tort')))
    expect(dettaglio.usatoIn).toMatchObject([{ eventoId: 'e', voceId: 'v' }])
  })

  it('eliminare un piatto lascia la voce con il suo nome', async () => {
    await lasagne()
    await t.scrivi('POST', '/api/v1/eventi', { id: 'e', nome: 'Natale', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '' })
    const ev = corpo(await t.leggi('/api/v1/eventi/e'))
    await t.scrivi('POST', '/api/v1/eventi/e/voci', { voci: [{ id: 'v', portataId: ev.portate[1].id, nome: 'Lasagne della nonna', piattoId: 'p-lasagne' }] })
    expect((await t.scrivi('DELETE', '/api/v1/piatti/p-lasagne?versione=1')).statusCode).toBe(204)
    expect(corpo(await t.leggi('/api/v1/voci/v'))).toMatchObject({ nome: 'Lasagne della nonna', piattoId: null, versione: 2 })
  })
})

describe('catalogo ingredienti', () => {
  it('catalogo iniziale presente', async () => {
    const elenco = corpo(await t.leggi('/api/v1/ingredienti'))
    expect(elenco.length).toBeGreaterThanOrEqual(200)
    SchemaIngrediente.parse(elenco[0])
    expect(elenco.find((i: { id: string }) => i.id === 'ing-parmigiano-reggiano').sinonimi).toContain('parmigiano')
  })

  it('creazione, sinonimi unici fra nomi e sinonimi, modifica', async () => {
    const r = await t.scrivi('POST', '/api/v1/ingredienti', { id: 'ing-x', nome: 'Pecorino sardo', sinonimi: ['fiore sardo'], repartoId: 'rep-salumi-formaggi', unitaPreferita: 'g', scalaturaAbituale: 'proporzionale' })
    expect(r.statusCode, r.body).toBe(201)
    const dup = await t.scrivi('POST', '/api/v1/ingredienti', { id: 'ing-y', nome: 'Formaggio Y', sinonimi: ['parmigiano'], repartoId: 'rep-altro', unitaPreferita: null, scalaturaAbituale: 'proporzionale' })
    expect(dup.statusCode).toBe(422)
    expect(corpo(dup).errore.messaggio).toMatch(/sinonimo di «Parmigiano Reggiano»|parmigiano reggiano/i)
    const dup2 = await t.scrivi('POST', '/api/v1/ingredienti', { id: 'ing-z', nome: 'Burro', sinonimi: [], repartoId: 'rep-altro', unitaPreferita: null, scalaturaAbituale: 'proporzionale' })
    expect(dup2.statusCode).toBe(422)
    const m = await t.scrivi('PUT', '/api/v1/ingredienti/ing-x', { nome: 'Pecorino sardo', sinonimi: ['fiore sardo', 'pecorino di sardegna'], repartoId: 'rep-salumi-formaggi', unitaPreferita: 'g', scalaturaAbituale: 'proporzionale', versione: 1 })
    expect(corpo(m).sinonimi).toEqual(['fiore sardo', 'pecorino di sardegna'])
  })

  it('eliminare un ingrediente scollega i piatti', async () => {
    await lasagne()
    const burro = corpo(await t.leggi('/api/v1/ingredienti/ing-burro'))
    expect(corpo(await t.leggi('/api/v1/ingredienti/ing-burro/usi')).piatti).toEqual([{ id: 'p-lasagne', nome: 'Lasagne alla bolognese' }])
    expect((await t.scrivi('DELETE', `/api/v1/ingredienti/ing-burro?versione=${burro.versione}`)).statusCode).toBe(204)
    const p = SchemaDettaglioPiatto.parse(corpo(await t.leggi('/api/v1/piatti/p-lasagne')))
    expect(p.ingredienti.find((i) => i.nome === 'burro')?.ingredienteId).toBeNull()
  })
})

describe('reparti', () => {
  it('creazione, nome duplicato, riordino, eliminazione con spostamento in «Altro»', async () => {
    const r = await t.scrivi('POST', '/api/v1/reparti', { id: 'rep-gastronomia', nome: 'Gastronomia' })
    expect(r.statusCode).toBe(201)
    expect((await t.scrivi('POST', '/api/v1/reparti', { id: 'rep-z', nome: 'dispensa' })).statusCode).toBe(422)
    await t.scrivi('POST', '/api/v1/ingredienti', { id: 'ing-g', nome: 'Insalata russa', sinonimi: [], repartoId: 'rep-gastronomia', unitaPreferita: 'g', scalaturaAbituale: 'proporzionale' })
    const reparti = corpo(await t.leggi('/api/v1/reparti'))
    const ordine = [...reparti].reverse().map((x: { id: string; versione: number }) => ({ id: x.id, versione: x.versione }))
    const o = await t.scrivi('PUT', '/api/v1/reparti/ordine', { voci: ordine })
    expect(o.statusCode, o.body).toBe(200)
    expect(corpo(o)[0].id).toBe('rep-gastronomia')
    expect((await t.scrivi('DELETE', '/api/v1/reparti/rep-altro?versione=1')).statusCode).toBe(422)
    expect((await t.scrivi('DELETE', '/api/v1/reparti/rep-gastronomia?versione=1')).statusCode).toBe(204)
    expect(uno(t.db, "SELECT reparto_id FROM ingredienti WHERE id = 'ing-g'")).toEqual({ reparto_id: 'rep-altro' })
  })
})
