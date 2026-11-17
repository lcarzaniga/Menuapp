// «Per te» (SPEC §31.3): cose da portare affidate all'utente e sondaggi a cui non ha risposto,
// solo negli eventi e nelle Famiglie che vede ancora; niente archiviati, niente cose fatte.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PerTe } from '../../src/contratto/edizioni.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const perTe = async (c: ClientDiProva) => corpo(await c.leggi(`${P}/per-te`)) as PerTe

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
})
afterEach(() => t.chiudi())

describe('per te', () => {
  it('le mie cose da portare e i sondaggi senza la mia risposta, con il collegamento al contenuto', async () => {
    const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '', gruppoId: G }))
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[4].id, nome: 'Tiramisù' }] }))
    const voce = corpo(await anna.leggi(`${P}/eventi/ev/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'v1')
    await ok(anna.scrivi('POST', `${P}/voci/v1/prendi`, { versione: voce.versione, togliDallaSpesa: false }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-vino', nome: 'Vino', prendo: true }))
    await ok(t.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 's1', testo: 'Che ora?', sondaggio: { opzioni: ['12', '13'] } }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 's2', testo: 'Dolce?', sondaggio: { opzioni: ['Sì', 'No'] } }))

    const d = await perTe(anna)
    expect(d.incarichi.map((i) => [i.tipo, i.nome, i.evento, i.collegamento])).toEqual([
      ['voce', 'Tiramisù', 'Natale', '/eventi/ev/chi-porta?incarico=voce%3Av1'],
      ['cosa', 'Vino', 'Natale', '/eventi/ev/chi-porta?incarico=cosa%3Ac-vino'],
    ])
    expect(d.sondaggi.map((x) => [x.testo, x.dove, x.collegamento]).sort()).toEqual([
      ['Che ora?', 'Famiglia', `/famiglia?famiglia=${G}&messaggio=s1`],
      ['Dolce?', 'Natale', '/eventi/ev/bacheca?messaggio=s2'],
    ])
    // Votato o fatto: sparisce.
    const s1 = corpo(await anna.leggi(`${P}/messaggi/s1`))
    await ok(anna.scrivi('PUT', `${P}/messaggi/s1/voto`, { opzioni: [s1.sondaggio.opzioni[0].id] }))
    const vino = corpo(await anna.leggi(`${P}/eventi/ev/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'c-vino')
    await ok(anna.scrivi('POST', `${P}/cose/c-vino/completa`, { versione: vino.versione, completato: true }))
    const dopo = await perTe(anna)
    expect(dopo.incarichi.map((i) => i.nome)).toEqual(['Tiramisù'])
    expect(dopo.sondaggi.map((x) => x.testo)).toEqual(['Dolce?'])
    // Chi non partecipa alla bacheca dell'evento non riceve il sondaggio dell'evento.
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura', partecipa: false }))
    expect((await perTe(anna)).sondaggi).toEqual([])
    // Accesso revocato: niente più dell'evento.
    await ok(t.scrivi('DELETE', `${P}/eventi/ev/condivisioni/${anna.id}`))
    expect((await perTe(anna)).incarichi).toEqual([])
    // Archiviato: nemmeno per chi organizza.
    await ok(t.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-pane', nome: 'Pane', prendo: true }))
    expect((await perTe(t)).incarichi.map((i) => i.nome)).toEqual(['Pane'])
    const e = corpo(await t.leggi(`${P}/eventi/ev`))
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: e.versione }))
    expect((await perTe(t)).incarichi).toEqual([])
    // Senza sessione: niente.
    expect((await t.app.inject({ method: 'GET', url: `${P}/per-te` })).statusCode).toBe(401)
  })
})
