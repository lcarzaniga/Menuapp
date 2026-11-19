// «Chi porta cosa» flessibile (SPEC §39): piatto definito, piatto a scelta («un primo a scelta»,
// anche più d'uno), contributo generico (cosa da portare). Menù e Chi porta sono lo stesso record.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, tutti } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let bruno: ClientDiProva & { id: string }
let carla: ClientDiProva & { id: string }
let portate: { id: string; nome: string }[]
const P = '/api/v1'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const incarico = async (id: string, c: ClientDiProva = t) => corpo(await c.leggi(`${P}/eventi/ev/incarichi`)).incarichi.find((i: { id: string }) => i.id === id)
const riepilogo = async () => corpo(await t.leggi(`${P}/eventi/ev/riepilogo`))

beforeEach(async () => {
  t = await appDiProva()
  bruno = t.utente('Bruno')
  carla = t.utente('Carla')
  portate = (await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-06-01', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '', gruppoId: 'gruppo-famiglia' }))).portate
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'lettura' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${carla.id}`, { permesso: 'lettura' }))
})
afterEach(() => t.chiudi())

describe('piatto a scelta', () => {
  it('nel menù «da definire», in Chi porta lo stesso record; niente ricetta, spesa o avvisi; la portata conta come coperta', async () => {
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-ragu', nome: 'Ragù', ingredienti: [] }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-ant', portataId: portate[0]!.id, nome: 'Antipasti a scelta', daDefinire: true, contributi: 2, piattoId: 'p-ragu' }] }))
    const menu = corpo(await t.leggi(`${P}/eventi/ev/menu`))
    expect(menu.portate[0].voci[0]).toMatchObject({ id: 'v-ant', daDefinire: true, contributi: 2, piattoId: null })
    expect(await incarico('v-ant')).toMatchObject({ tipo: 'voce', nome: 'Antipasti a scelta', daDefinire: true, contributi: 2, stato: 'da_assegnare' })
    const r = await riepilogo()
    expect(r.menu.portateVuote).not.toContain('Antipasti')
    expect(r.incarichi).toMatchObject({ contributiSenzaResponsabile: 1, piattiNonAffidati: 0 })
    expect(r.spesa).toBeNull()
    expect(corpo(await t.leggi(`${P}/eventi/ev/spesa`)).avvisi).toEqual([])
    // Nel database: mai un contributo da definire con una ricetta.
    expect(() => esegui(t.db, "UPDATE voci_menu SET piatto_id = 'p-ragu' WHERE id = 'v-ant'")).toThrow(/da definire/)
  })

  it('affidato e poi precisato da chi lo porta: stessa riga, stesso incarico; solo lui o chi organizza', async () => {
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-primo', portataId: portate[1]!.id, nome: 'Primo a scelta', daDefinire: true }] }))
    const i = await incarico('v-primo')
    await ok(t.scrivi('POST', `${P}/voci/v-primo/assegna`, { versione: i.versione, utenteId: bruno.id, note: 'per 8' }))
    expect((await riepilogo()).incarichi.contributiSenzaResponsabile).toBe(0)
    const assegnato = await incarico('v-primo', bruno)
    expect((await carla.scrivi('POST', `${P}/voci/v-primo/precisa`, { versione: assegnato.versione, nome: 'Furbata' })).statusCode).toBe(403)
    const precisato = await ok(bruno.scrivi('POST', `${P}/voci/v-primo/precisa`, { versione: assegnato.versione, nome: 'Lasagne alla bolognese' }))
    expect(precisato).toMatchObject({ id: 'v-primo', nome: 'Lasagne alla bolognese', daDefinire: false, incaricato: 'Bruno', stato: 'assegnato', note: 'per 8' })
    expect(corpo(await t.leggi(`${P}/eventi/ev/menu`)).portate[1].voci).toEqual([expect.objectContaining({ id: 'v-primo', nome: 'Lasagne alla bolognese', daDefinire: false, incaricato: 'Bruno' })])
    expect(tutti(t.db, "SELECT count(*) AS n FROM voci_menu WHERE evento_id = 'ev'")).toEqual([{ n: 1 }])
    expect((await bruno.scrivi('POST', `${P}/voci/v-primo/precisa`, { versione: precisato.versione, nome: 'Altro' })).statusCode).toBe(422)
  })

  it('collegare una ricetta dal menù lo precisa; i client che non conoscono i campi non li cambiano', async () => {
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-tiramisu', nome: 'Tiramisù', ingredienti: [] }))
    const [v] = await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-dolce', portataId: portate[4]!.id, nome: 'Dolce a scelta', daDefinire: true, contributi: 3 }] }))
    const base = { nome: 'Dolce a scelta', piattoId: null, porzioni: null, incaricato: '', inSpesa: true, note: '' }
    const dopo = await ok(t.scrivi('PUT', `${P}/voci/v-dolce`, { ...base, versione: v.versione }))
    expect(dopo).toMatchObject({ daDefinire: true, contributi: 3 })
    const collegata = await ok(t.scrivi('PUT', `${P}/voci/v-dolce`, { ...base, nome: 'Tiramisù', piattoId: 'p-tiramisu', versione: dopo.versione }))
    expect(collegata).toMatchObject({ daDefinire: false, piattoId: 'p-tiramisu', contributi: 3 })
  })

  it('duplicando l\'evento i piatti a scelta restano a scelta', async () => {
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-cont', portataId: portate[3]!.id, nome: 'Contorni a scelta', daDefinire: true, contributi: 2 }] }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/duplica`, { id: 'ev2', nome: 'Pranzo 2', data: '2031-06-01' }))
    const voci = corpo(await t.leggi(`${P}/eventi/ev2/menu`)).portate.flatMap((p: { voci: unknown[] }) => p.voci)
    expect(voci).toEqual([expect.objectContaining({ nome: 'Contorni a scelta', daDefinire: true, contributi: 2 })])
  })
})
