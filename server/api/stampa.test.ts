import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaStileStampa } from '../../src/contratto/stampa.ts'
import { opzioniPredefinite } from '../../src/domain/stampa.ts'
import { esegui, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())

const corpo = (r: { body: string }) => JSON.parse(r.body)
const URL = '/api/v1/eventi/ev-natale/stampa'

async function creaEvento(occasione = 'Natale', nome = 'Natale 2026') {
  const r = await t.scrivi('POST', '/api/v1/eventi', { id: 'ev-natale', nome, data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione, adulti: 8, bambini: 2, note: '' })
  expect(r.statusCode).toBe(201)
  return corpo(r) as { versione: number }
}
async function leggi() {
  const r = await t.leggi(URL)
  expect(r.statusCode, r.body).toBe(200)
  return SchemaStileStampa.parse(corpo(r))
}
const revisione = async () => corpo(await t.leggi('/api/v1/revisione')).revisione as number

describe('stile del menù stampato', () => {
  it('senza salvataggi restituisce i predefiniti dell\'evento (modello dall\'occasione)', async () => {
    await creaEvento()
    const s = await leggi()
    expect(s.versione).toBe(0)
    expect(s.aggiornatoIl).toBeNull()
    expect(s.opzioni).toEqual(opzioniPredefinite({ occasione: 'Natale', nome: 'Natale 2026' }))
    expect(s.opzioni).toMatchObject({ modello: 'natale', palette: 'natale', formato: 'A4', titolo: null, nascondiPortateVuote: true })
  })

  it('predefiniti per altre occasioni', () => {
    expect(opzioniPredefinite({ occasione: 'Compleanno', nome: 'Festa di Anna' }).modello).toBe('festivo')
    expect(opzioniPredefinite({ occasione: 'Capodanno', nome: 'Cenone' }).modello).toBe('elegante')
    expect(opzioniPredefinite({ occasione: '', nome: 'Domenica dai nonni' }).modello).toBe('elegante')
  })

  it('salva, rilegge e aggiorna con la versione; non tocca evento e menù', async () => {
    const ev = await creaEvento()
    const prima = await revisione()
    const opzioni = { ...opzioniPredefinite({ occasione: 'Natale', nome: '' }), modello: 'rustico', formato: 'A5x2', titolo: '  Pranzo di Natale  ', sottotitolo: 'Casa Carzaniga', nota: 'Buone feste!', mostraNote: true } as const
    const r = await t.scrivi('PUT', URL, { opzioni, versione: 0 })
    expect(r.statusCode, r.body).toBe(200)
    const s = SchemaStileStampa.parse(corpo(r))
    expect(s.versione).toBe(1)
    expect(s.opzioni).toEqual({ ...opzioni, titolo: 'Pranzo di Natale' })
    expect(await revisione()).toBeGreaterThan(prima)
    expect(await leggi()).toEqual(s)

    const r2 = await t.scrivi('PUT', URL, { opzioni: { ...opzioni, titolo: '' }, versione: 1 })
    expect(r2.statusCode).toBe(200)
    expect(corpo(r2)).toMatchObject({ versione: 2, opzioni: { titolo: null } })

    const evento = corpo(await t.leggi('/api/v1/eventi/ev-natale'))
    expect(evento.versione).toBe(ev.versione)
  })

  it('valida le opzioni', async () => {
    await creaEvento()
    const base = opzioniPredefinite({ occasione: '', nome: '' })
    for (const sbagliate of [
      { ...base, modello: 'barocco' },
      { ...base, formato: 'A3' },
      { ...base, palette: 'fucsia' },
      { ...base, caratteri: 'comic' },
      { ...base, nota: 'x'.repeat(601) },
      { ...base, titolo: 'x'.repeat(121) },
      { ...base, decorazioni: 'sì' },
      { modello: 'elegante' },
    ]) {
      const r = await t.scrivi('PUT', URL, { opzioni: sbagliate, versione: 0 })
      expect(r.statusCode, JSON.stringify(sbagliate).slice(0, 80)).toBe(400)
    }
    expect((await leggi()).versione).toBe(0)
  })

  it('evento inesistente → 404', async () => {
    expect((await t.leggi('/api/v1/eventi/nessuno/stampa')).statusCode).toBe(404)
    const r = await t.scrivi('PUT', '/api/v1/eventi/nessuno/stampa', { opzioni: opzioniPredefinite({ occasione: '', nome: '' }), versione: 0 })
    expect(r.statusCode).toBe(404)
  })

  it('due dispositivi: il secondo salvataggio con versione vecchia riceve 409 con lo stile attuale', async () => {
    await creaEvento()
    const base = (await leggi()).opzioni
    const a = await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'minimal' }, versione: 0 })
    expect(a.statusCode).toBe(200)
    // Il secondo dispositivo aveva letto la versione 0: anche il «primo salvataggio» va in conflitto.
    const b = await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'festivo' }, versione: 0 })
    expect(b.statusCode).toBe(409)
    expect(corpo(b).errore.dettagli.attuale).toMatchObject({ versione: 1, opzioni: { modello: 'minimal' } })
    const c = await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'festivo' }, versione: 1 })
    expect(c.statusCode).toBe(200)
    const d = await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'elegante' }, versione: 1 })
    expect(d.statusCode).toBe(409)
    expect((await leggi()).opzioni.modello).toBe('festivo')
  })

  it('opzioni salvate non più valide tornano al predefinito campo per campo', async () => {
    await creaEvento()
    await t.scrivi('PUT', URL, { opzioni: { ...opzioniPredefinite({ occasione: '', nome: '' }), nota: 'Grazie', modello: 'minimal' }, versione: 0 })
    esegui(t.db, "UPDATE stili_stampa SET opzioni = json_set(opzioni, '$.palette', 'scomparsa', '$.futuro', 1)")
    const s = await leggi()
    expect(s.opzioni.palette).toBe('natale')
    expect(s.opzioni).toMatchObject({ nota: 'Grazie', modello: 'minimal' })
    expect(s.opzioni).not.toHaveProperty('futuro')
  })

  it('evento archiviato: sola lettura e stile dallo snapshot; dopo la riapertura si modifica di nuovo', async () => {
    let ev = await creaEvento()
    const base = (await leggi()).opzioni
    await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'elegante', nota: 'Archiviata' }, versione: 0 })
    const ar = await t.scrivi('POST', '/api/v1/eventi/ev-natale/archivia', { versione: ev.versione })
    expect(ar.statusCode, ar.body).toBe(200)
    ev = corpo(ar)

    const snap = corpo(await t.leggi('/api/v1/eventi/ev-natale/snapshot'))[0]
    expect(snap.contenuto.stampa).toMatchObject({ modello: 'elegante', nota: 'Archiviata' })

    const r = await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'festivo' }, versione: 1 })
    expect(r.statusCode).toBe(422)
    expect(corpo(r).errore.dettagli?.regola ?? corpo(r).errore.messaggio).toMatch(/archiviat/)

    // Anche se la riga viva cambiasse, l'evento archiviato mostra lo stile fotografato.
    esegui(t.db, "UPDATE stili_stampa SET opzioni = json_set(opzioni, '$.nota', 'cambiata')")
    expect((await leggi()).opzioni.nota).toBe('Archiviata')

    const ri = await t.scrivi('POST', '/api/v1/eventi/ev-natale/riapri', { versione: ev.versione })
    expect(ri.statusCode, ri.body).toBe(200)
    expect((await leggi()).opzioni.nota).toBe('cambiata')
    expect((await t.scrivi('PUT', URL, { opzioni: { ...base, modello: 'festivo' }, versione: 1 })).statusCode).toBe(200)
  })

  it('l\'eliminazione dell\'evento elimina anche lo stile', async () => {
    const ev = await creaEvento()
    await t.scrivi('PUT', URL, { opzioni: (await leggi()).opzioni, versione: 0 })
    const r = await t.scrivi('DELETE', `/api/v1/eventi/ev-natale?versione=${ev.versione}`)
    expect(r.statusCode).toBe(204)
    expect(uno(t.db, 'SELECT COUNT(*) AS n FROM stili_stampa')).toEqual({ n: 0 })
  })
})
