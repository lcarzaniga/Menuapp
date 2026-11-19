// Regia della cucina (SPEC §38): piano, piatti, tempi e attrezzature in una lettura; permessi del piano.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaRegia } from '../../src/contratto/regia.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
const P = '/api/v1'
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}

beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())

describe('regia della cucina', () => {
  it('attività con piatto, tempi e attrezzature dal testo della ricetta; piatti anche senza attività', async () => {
    const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale', data: '2030-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '' }))
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-lasagne', nome: 'Lasagne', tempoPreparazioneMin: 40, tempoCotturaMin: 45, attrezzature: ['teglia'], procedimento: ['Infornare a 180 °C'] }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[1].id, nome: 'Lasagne', piattoId: 'p-lasagne' }, { id: 'v2', portataId: ev.portate[4].id, nome: 'Panettone' }] }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/attivita`, { id: 'a1', titolo: 'Preparare le lasagne', data: '2030-12-25', ora: '11:00', voceMenuId: 'v1', note: '' }))
    const r = SchemaRegia.parse(await ok(t.leggi(`${P}/eventi/ev/regia`)))
    expect(r.evento).toMatchObject({ nome: 'Natale', oraServizio: '13:00', archiviato: false })
    expect(r.attivita.map((a) => [a.titolo, a.voceMenuId])).toEqual([['Preparare le lasagne', 'v1']])
    expect(r.piatti).toEqual([
      { voceId: 'v1', nome: 'Lasagne', portata: 'Primi', piattoId: 'p-lasagne', preparazione: 40, cottura: 45, riposo: null, attrezzature: ['teglia'], usa: ['forno'] },
      { voceId: 'v2', nome: 'Panettone', portata: 'Dolci', piattoId: null, preparazione: null, cottura: null, riposo: null, attrezzature: [], usa: [] },
    ])
    expect(r.puoModificare).toBe(true)
  })

  it('permessi come il piano: in lettura si vede senza spuntare; chi non vede l\'evento non vede la regia', async () => {
    await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 2, bambini: 0, note: '' }))
    const anna: ClientDiProva & { id: string } = t.utente('Anna')
    const estraneo = t.utente('Estraneo', 'utente', false)
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    expect((await ok(anna.leggi(`${P}/eventi/ev/regia`))).puoModificare).toBe(false)
    expect((await estraneo.leggi(`${P}/eventi/ev/regia`)).statusCode).toBe(404)
    expect((await t.anonimo.leggi(`${P}/eventi/ev/regia`)).statusCode).toBe(401)
  })
})
