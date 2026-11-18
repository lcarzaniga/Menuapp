import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaEvento, SchemaMenu, SchemaRiepilogoEvento, SchemaVoceMenu } from '../../src/contratto/eventi.ts'
import { esegui } from '../db/connessione.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'
import { _impostaStato } from '../servizi/eventi.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())

const corpo = (r: { body: string }) => JSON.parse(r.body)
const natale = { id: 'ev-natale', nome: 'Natale 2026', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 4, note: '' }

async function creaNatale() {
  const r = await t.scrivi('POST', '/api/v1/eventi', natale)
  expect(r.statusCode).toBe(201)
  return SchemaEvento.parse(corpo(r))
}
async function menu() {
  return SchemaMenu.parse(corpo(await t.leggi('/api/v1/eventi/ev-natale/menu')))
}
async function aggiungi(nomi: string[], portata: string, extra: Record<string, unknown> = {}) {
  const r = await t.scrivi('POST', '/api/v1/eventi/ev-natale/voci', {
    voci: nomi.map((nome, i) => ({ id: `v-${nome}`, portataId: portata, nome, ...extra, ...(i === 0 ? {} : {}) })),
  })
  expect(r.statusCode, r.body).toBe(201)
  return corpo(r).map((v: unknown) => SchemaVoceMenu.parse(v))
}

describe('eventi', () => {
  it('creazione con portate predefinite e coefficiente dalle impostazioni', async () => {
    const e = await creaNatale()
    expect(e.portate.map((p) => p.nome)).toEqual(['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Frutta e caffè', 'Bevande'])
    expect(e.coefficienteBambini).toBe(0.5)
    expect(e.stato).toBe('attivo')
    const elenco = corpo(await t.leggi('/api/v1/eventi?stato=attivo')).map((x: unknown) => SchemaRiepilogoEvento.parse(x))
    expect(elenco[0]).toMatchObject({ id: 'ev-natale', copertiEquivalenti: 10, numeroVoci: 0 })
  })

  it('creazione ripetuta con lo stesso id e contenuto → 200; contenuto diverso → 409', async () => {
    await creaNatale()
    expect((await t.scrivi('POST', '/api/v1/eventi', natale)).statusCode).toBe(200)
    const r = await t.scrivi('POST', '/api/v1/eventi', { ...natale, nome: 'Altro' })
    expect(r.statusCode).toBe(409)
    expect(corpo(r).errore.codice).toBe('id_esistente')
  })

  it('validazione dei campi', async () => {
    for (const errato of [{ data: '2026-13-01' }, { oraServizio: '25:00' }, { tipo: 'merenda' }, { adulti: -1 }, { bambini: 1.5 }, { nome: '  ' }, { coefficienteBambini: 0.33 }]) {
      const r = await t.scrivi('POST', '/api/v1/eventi', { ...natale, id: 'x', ...errato })
      expect(r.statusCode, JSON.stringify(errato)).toBe(400)
    }
  })

  it('modifica con portate rinominate, aggiunte, riordinate ed eliminate se vuote', async () => {
    const e = await creaNatale()
    const [antipasti, primi] = e.portate
    const r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale', {
      ...natale,
      coefficienteBambini: 0.6,
      portate: [{ id: primi!.id, nome: 'Primi piatti' }, { id: antipasti!.id, nome: 'Antipasti' }, { id: 'nuova', nome: 'Aperitivo' }],
      versione: e.versione,
    })
    expect(r.statusCode, r.body).toBe(200)
    const dopo = SchemaEvento.parse(corpo(r))
    expect(dopo.portate.map((p) => p.nome)).toEqual(['Primi piatti', 'Antipasti', 'Aperitivo'])
    expect(dopo.versione).toBe(e.versione + 1)
    expect(dopo.coefficienteBambini).toBe(0.6)
  })

  it('una portata con voci non si elimina (422) e nulla cambia', async () => {
    const e = await creaNatale()
    await aggiungi(['Lasagne'], e.portate[1]!.id)
    const r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale', { ...natale, coefficienteBambini: 0.5, portate: [{ id: e.portate[0]!.id, nome: 'Antipasti' }], versione: e.versione })
    expect(r.statusCode).toBe(422)
    expect(corpo(r).errore.dettagli.regola).toBe('portata_non_vuota')
    expect(SchemaEvento.parse(corpo(await t.leggi('/api/v1/eventi/ev-natale'))).portate).toHaveLength(7)
  })

  it('conflitto di versione fra due dispositivi', async () => {
    const e = await creaNatale()
    const base = { ...natale, coefficienteBambini: 0.5, portate: e.portate, versione: e.versione }
    expect((await t.scrivi('PUT', '/api/v1/eventi/ev-natale', { ...base, note: 'dal PC' })).statusCode).toBe(200)
    const r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale', { ...base, note: 'dal telefono' })
    expect(r.statusCode).toBe(409)
    expect(corpo(r).errore.dettagli.attuale.note).toBe('dal PC')
  })

  it('concludi e riapri; transizioni non ammesse', async () => {
    const e = await creaNatale()
    const c = SchemaEvento.parse(corpo(await t.scrivi('POST', '/api/v1/eventi/ev-natale/concludi', { versione: e.versione })))
    expect(c.stato).toBe('concluso')
    expect(c.conclusoIl).not.toBeNull()
    expect((await t.scrivi('POST', '/api/v1/eventi/ev-natale/concludi', { versione: c.versione })).statusCode).toBe(422)
    const a = SchemaEvento.parse(corpo(await t.scrivi('POST', '/api/v1/eventi/ev-natale/riapri', { versione: c.versione })))
    expect(a.stato).toBe('attivo')
  })

  it('evento archiviato: nessuna modifica ammessa', async () => {
    const e = await creaNatale()
    _impostaStato(t.db, 'ev-natale', 'archiviato')
    const r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale', { ...natale, coefficienteBambini: 0.5, portate: e.portate, versione: e.versione })
    expect(r.statusCode).toBe(422)
    expect(corpo(r).errore.dettagli.regola).toBe('evento_archiviato')
    expect((await t.scrivi('POST', '/api/v1/eventi/ev-natale/voci', { voci: [{ id: 'v', portataId: e.portate[0]!.id, nome: 'X' }] })).statusCode).toBe(422)
  })

  it('eliminazione con versione', async () => {
    const e = await creaNatale()
    await aggiungi(['Lasagne'], e.portate[1]!.id)
    expect((await t.scrivi('DELETE', `/api/v1/eventi/ev-natale?versione=${e.versione + 5}`)).statusCode).toBe(409)
    expect((await t.scrivi('DELETE', `/api/v1/eventi/ev-natale?versione=${e.versione}`)).statusCode).toBe(204)
    expect((await t.leggi('/api/v1/eventi/ev-natale')).statusCode).toBe(404)
  })
})

describe('menù', () => {
  it('inserimento multiriga, porzioni effettive e posizione esplicita', async () => {
    const e = await creaNatale()
    const primi = e.portate[1]!.id
    await aggiungi(['Lasagne', 'Tortellini in brodo'], primi)
    await t.scrivi('POST', '/api/v1/eventi/ev-natale/voci', { voci: [{ id: 'v-risotto', portataId: primi, nome: 'Risotto', porzioni: 6, ordine: 0 }] })
    const m = await menu()
    const voci = m.portate.find((p) => p.id === primi)!.voci
    expect(voci.map((v) => v.nome)).toEqual(['Risotto', 'Lasagne', 'Tortellini in brodo'])
    expect(voci.map((v) => v.ordine)).toEqual([0, 1, 2])
    expect(voci.map((v) => v.porzioniEffettive)).toEqual([6, 10, 10])
    expect(m.copertiEquivalenti).toBe(10)
  })

  it('le porzioni seguono i coperti salvo quelle personalizzate', async () => {
    const e = await creaNatale()
    await aggiungi(['Lasagne'], e.portate[1]!.id)
    await t.scrivi('POST', '/api/v1/eventi/ev-natale/voci', { voci: [{ id: 'v-arrosto', portataId: e.portate[2]!.id, nome: 'Arrosto', porzioni: 6 }] })
    await t.scrivi('PUT', '/api/v1/eventi/ev-natale', { ...natale, coefficienteBambini: 0.5, bambini: 6, portate: e.portate, versione: e.versione })
    const m = await menu()
    expect(m.copertiEquivalenti).toBe(11)
    expect(m.portate[1]!.voci[0]!.porzioniEffettive).toBe(11)
    expect(m.portate[2]!.voci[0]!.porzioniEffettive).toBe(6)
  })

  it('aggiungere un nome non crea un piatto', async () => {
    const e = await creaNatale()
    await aggiungi(['Lasagne'], e.portate[1]!.id)
    expect((t.db.prepare('SELECT count(*) AS n FROM piatti').get() as { n: number }).n).toBe(0)
  })

  it('modifica di una voce, conflitto e piatto inesistente', async () => {
    const e = await creaNatale()
    const [v] = await aggiungi(['Lasagne'], e.portate[1]!.id)
    const dati = { nome: 'Lasagne della nonna', piattoId: null, porzioni: 12, incaricato: 'Zia Anna', inSpesa: false, note: 'senza funghi', versione: v.versione }
    const r = await t.scrivi('PUT', `/api/v1/voci/${v.id}`, dati)
    expect(r.statusCode).toBe(200)
    expect(SchemaVoceMenu.parse(corpo(r))).toMatchObject({ nome: 'Lasagne della nonna', porzioni: 12, incaricato: 'Zia Anna', inSpesa: false, versione: 2 })
    expect((await t.scrivi('PUT', `/api/v1/voci/${v.id}`, dati)).statusCode).toBe(409)
    expect((await t.scrivi('PUT', `/api/v1/voci/${v.id}`, { ...dati, piattoId: 'nessuno', versione: 2 })).statusCode).toBe(422)
  })

  it('eliminazione ricompatta l\'ordine', async () => {
    const e = await creaNatale()
    const voci = await aggiungi(['A', 'B', 'C'], e.portate[0]!.id)
    expect((await t.scrivi('DELETE', `/api/v1/voci/${voci[1].id}?versione=1`)).statusCode).toBe(204)
    expect((await menu()).portate[0]!.voci.map((v) => [v.nome, v.ordine])).toEqual([['A', 0], ['C', 1]])
  })

  it('riordino nella portata e spostamento fra portate', async () => {
    const e = await creaNatale()
    const [antipasti, primi] = [e.portate[0]!.id, e.portate[1]!.id]
    const a = await aggiungi(['A', 'B', 'C'], antipasti)
    const p = await aggiungi(['P'], primi)
    // C sale in cima agli antipasti
    let r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale/voci/ordine', { portataId: antipasti, voci: [a[2], a[0], a[1]].map((v) => ({ id: v.id, versione: v.versione })) })
    expect(r.statusCode, r.body).toBe(200)
    // A passa ai primi, dopo P
    r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale/voci/ordine', { portataId: primi, voci: [p[0], a[0]].map((v) => ({ id: v.id, versione: v.versione })) })
    expect(r.statusCode, r.body).toBe(200)
    const m = SchemaMenu.parse(corpo(r))
    expect(m.portate[0]!.voci.map((v) => [v.nome, v.ordine])).toEqual([['C', 0], ['B', 1]])
    expect(m.portate[1]!.voci.map((v) => [v.nome, v.ordine, v.versione])).toEqual([['P', 0, 1], ['A', 1, 2]])
  })

  it('riordino con una versione vecchia: 409 e nessuna modifica', async () => {
    const e = await creaNatale()
    const a = await aggiungi(['A', 'B'], e.portate[0]!.id)
    await t.scrivi('PUT', `/api/v1/voci/${a[0].id}`, { nome: 'A2', piattoId: null, porzioni: null, incaricato: '', inSpesa: true, note: '', versione: 1 })
    const r = await t.scrivi('PUT', '/api/v1/eventi/ev-natale/voci/ordine', { portataId: e.portate[0]!.id, voci: [{ id: a[1].id, versione: 1 }, { id: a[0].id, versione: 1 }] })
    expect(r.statusCode).toBe(409)
    expect((await menu()).portate[0]!.voci.map((v) => v.nome)).toEqual(['A2', 'B'])
  })

  it('voci di un\'altra portata o di un altro evento rifiutate', async () => {
    const e = await creaNatale()
    await t.scrivi('POST', '/api/v1/eventi', { ...natale, id: 'ev-2', nome: 'Capodanno' })
    const altro = SchemaEvento.parse(corpo(await t.leggi('/api/v1/eventi/ev-2')))
    const r = await t.scrivi('POST', '/api/v1/eventi/ev-natale/voci', { voci: [{ id: 'x', portataId: altro.portate[0]!.id, nome: 'X' }] })
    expect(r.statusCode).toBe(400)
    const [v] = await aggiungi(['A'], e.portate[0]!.id)
    const r2 = await t.scrivi('PUT', '/api/v1/eventi/ev-2/voci/ordine', { portataId: altro.portate[0]!.id, voci: [{ id: v.id, versione: 1 }] })
    expect(r2.statusCode).toBe(400)
    expect((await menu()).portate[0]!.voci).toHaveLength(1)
  })

  it('un\'operazione fallita a metà lotto non lascia voci parziali', async () => {
    const e = await creaNatale()
    const r = await t.scrivi('POST', '/api/v1/eventi/ev-natale/voci', {
      voci: [{ id: 'ok1', portataId: e.portate[0]!.id, nome: 'Ok' }, { id: 'ko', portataId: 'inesistente', nome: 'Ko' }],
    })
    expect(r.statusCode).toBe(400)
    expect((await menu()).portate[0]!.voci).toHaveLength(0)
    esegui(t.db, 'SELECT 1')
  })
})
