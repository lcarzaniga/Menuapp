import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaErrore, SchemaSalute } from '../../src/contratto/comune.ts'
import { SchemaImpostazioni, SchemaReparto } from '../../src/contratto/impostazioni.ts'
import { ultimaVersione } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())

const corpo = (r: { body: string }) => JSON.parse(r.body)

describe('salute e revisione', () => {
  it('salute è conforme al contratto', async () => {
    const r = await t.leggi('/api/v1/salute')
    expect(r.statusCode).toBe(200)
    const s = SchemaSalute.parse(corpo(r))
    expect(s.versioneSchema).toBe(ultimaVersione())
    expect(r.headers['cache-control']).toBe('no-store')
    expect(r.headers['x-content-type-options']).toBe('nosniff')
  })
  it('rotta inesistente → 404 nel formato d\'errore', async () => {
    const r = await t.leggi('/api/v1/nulla')
    expect(r.statusCode).toBe(404)
    expect(SchemaErrore.parse(corpo(r)).errore.codice).toBe('non_trovato')
  })
  it('manutenzione → 503 tranne salute', async () => {
    t.ctx.stato.manutenzione = true
    expect((await t.leggi('/api/v1/revisione')).statusCode).toBe(503)
    expect((await t.leggi('/api/v1/salute')).statusCode).toBe(200)
  })
})

describe('impostazioni', () => {
  it('lettura conforme e reparti ordinati', async () => {
    const imp = SchemaImpostazioni.parse(corpo(await t.leggi('/api/v1/impostazioni')))
    expect(imp.coefficienteBambini).toBe(0.5)
    expect(imp.portatePredefinite.map((p) => p.nome)).toEqual(['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Frutta e caffè', 'Bevande'])
    const reparti = corpo(await t.leggi('/api/v1/reparti')).map((r: unknown) => SchemaReparto.parse(r))
    expect(reparti).toHaveLength(14)
    expect(reparti.at(-1)).toMatchObject({ id: 'rep-altro', diSistema: true })
  })

  it('aggiornamento con versione corretta, revisione incrementata', async () => {
    const prima = corpo(await t.leggi('/api/v1/revisione')).revisione
    const r = await t.scrivi('PUT', '/api/v1/impostazioni', {
      coefficienteBambini: 0.6,
      portatePredefinite: [{ id: 'pp-a', nome: 'Antipasti' }, { id: 'pp-b', nome: 'Primi' }],
      versione: 1,
    })
    expect(r.statusCode).toBe(200)
    expect(corpo(r)).toMatchObject({ coefficienteBambini: 0.6, versione: 2 })
    expect(Number(r.headers['x-revisione'])).toBe(prima + 1)
  })

  it('due dispositivi sulla stessa versione: il secondo riceve 409 con il valore attuale', async () => {
    const base = { portatePredefinite: [{ id: 'pp-a', nome: 'Antipasti' }], versione: 1 }
    const primo = await t.scrivi('PUT', '/api/v1/impostazioni', { ...base, coefficienteBambini: 0.6 })
    const secondo = await t.scrivi('PUT', '/api/v1/impostazioni', { ...base, coefficienteBambini: 0.3 })
    expect(primo.statusCode).toBe(200)
    expect(secondo.statusCode).toBe(409)
    const e = SchemaErrore.parse(corpo(secondo)).errore
    expect(e.codice).toBe('conflitto_versione')
    expect(e.dettagli).toMatchObject({ attuale: { coefficienteBambini: 0.6, versione: 2 } })
    const ora = corpo(await t.leggi('/api/v1/impostazioni'))
    expect(ora.coefficienteBambini).toBe(0.6)
  })

  it('una scrittura respinta non incrementa la revisione', async () => {
    const prima = corpo(await t.leggi('/api/v1/revisione')).revisione
    await t.scrivi('PUT', '/api/v1/impostazioni', { coefficienteBambini: 0.6, portatePredefinite: [{ id: 'a', nome: 'A' }], versione: 7 })
    await t.scrivi('PUT', '/api/v1/impostazioni', { coefficienteBambini: 0.33, portatePredefinite: [{ id: 'a', nome: 'A' }], versione: 1 })
    expect(corpo(await t.leggi('/api/v1/revisione')).revisione).toBe(prima)
  })

  it('400 con i dettagli dei campi', async () => {
    const r = await t.scrivi('PUT', '/api/v1/impostazioni', { coefficienteBambini: 0.33, portatePredefinite: [], versione: 1 })
    expect(r.statusCode).toBe(400)
    const e = SchemaErrore.parse(corpo(r)).errore
    expect(e.codice).toBe('richiesta_non_valida')
    expect(JSON.stringify(e.dettagli)).toMatch(/0,05/)
  })

  it('portate con lo stesso nome → 400 e nessuna modifica', async () => {
    const r = await t.scrivi('PUT', '/api/v1/impostazioni', {
      coefficienteBambini: 0.5,
      portatePredefinite: [{ id: 'a', nome: 'Primi' }, { id: 'b', nome: 'primi ' }],
      versione: 1,
    })
    expect(r.statusCode).toBe(400)
    expect(corpo(await t.leggi('/api/v1/impostazioni')).versione).toBe(1)
  })
})

describe('protezione delle scritture', () => {
  const dati = JSON.stringify({ coefficienteBambini: 0.5, portatePredefinite: [{ id: 'a', nome: 'A' }], versione: 1 })
  it('senza Origin → 403', async () => {
    const r = await t.inietta({ method: 'PUT', url: '/api/v1/impostazioni', headers: { 'content-type': 'application/json' }, payload: dati })
    expect(r.statusCode).toBe(403)
    expect(corpo(r).errore.codice).toBe('origine_non_ammessa')
  })
  it('con Origin estranea → 403', async () => {
    const r = await t.inietta({ method: 'PUT', url: '/api/v1/impostazioni', headers: { origin: 'https://cattivo.example', 'content-type': 'application/json' }, payload: dati })
    expect(r.statusCode).toBe(403)
  })
  it('senza JSON → 415', async () => {
    const r = await t.inietta({ method: 'PUT', url: '/api/v1/impostazioni', headers: { origin: ORIGINE_PROVA, 'content-type': 'text/plain' }, payload: dati })
    expect(r.statusCode).toBe(415)
    expect(corpo(r).errore.codice).toBe('tipo_non_supportato')
  })
  it('JSON malformato → 400', async () => {
    const r = await t.inietta({ method: 'PUT', url: '/api/v1/impostazioni', headers: { origin: ORIGINE_PROVA, 'content-type': 'application/json' }, payload: '{rotto' })
    expect(r.statusCode).toBe(400)
  })
  it('corpo troppo grande → 413', async () => {
    const r = await t.inietta({ method: 'PUT', url: '/api/v1/impostazioni', headers: { origin: ORIGINE_PROVA, 'content-type': 'application/json' }, payload: JSON.stringify({ x: 'a'.repeat(1_100_000) }) })
    expect(r.statusCode).toBe(413)
  })
})
