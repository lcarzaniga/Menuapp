// Ricette della Famiglia attiva (SPEC §37): le personali si vedono sempre, quelle di una Famiglia
// solo con quella Famiglia attiva; nei menù una ricetta di un'altra Famiglia entra come copia.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tutti } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ID_AMMINISTRATORE } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
let bruno: ClientDiProva & { id: string }
const P = '/api/v1'
const G = 'gruppo-famiglia'
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const token = (link: string) => link.split('/#/unisciti/')[1]!
const ids = async (c: ClientDiProva, q = '') => (await ok<{ id: string }[]>(c.leggi(`${P}/piatti${q}`))).map((p) => p.id).sort()

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna') // nella Famiglia di prova e nei Rossi
  bruno = t.utente('Bruno', 'utente', false) // solo nei Rossi
  await ok(anna.scrivi('POST', `${P}/famiglie`, { id: 'rossi', nome: 'Famiglia Rossi' }))
  const inv = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
  await ok(bruno.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(inv.link) }))
  await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'personale', nome: 'Mia torta', visibilita: 'privata', famigliaOrigine: G }))
  await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'di-g', nome: 'Ragù', famiglie: [G] }))
  await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'di-rossi', nome: 'Polenta', famiglie: ['rossi'] }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'altrui-g', nome: 'Lasagne', famiglie: [G] }))
  await ok(bruno.scrivi('POST', `${P}/piatti`, { id: 'altrui-rossi', nome: 'Canederli', famiglie: ['rossi'] }))
})
afterEach(() => t.chiudi())

describe('ricettario della Famiglia attiva', () => {
  it('le personali sempre, quelle di una Famiglia solo con quella attiva; senza Famiglia indicata tutte', async () => {
    expect(await ids(anna, `?famiglia=${G}`)).toEqual(['altrui-g', 'di-g', 'personale'])
    expect(await ids(anna, '?famiglia=rossi')).toEqual(['altrui-rossi', 'di-rossi', 'personale'])
    expect(await ids(anna)).toEqual(['altrui-g', 'altrui-rossi', 'di-g', 'di-rossi', 'personale'])
    // Una Famiglia di cui non si fa parte non apre nulla: restano le personali.
    expect(await ids(bruno, `?famiglia=${G}`)).toEqual([])
    expect(await ids(bruno, '?famiglia=rossi')).toEqual(['altrui-rossi', 'di-rossi'])
  })

  it('le pubbliche seguono la preferenza, non la Famiglia attiva', async () => {
    await ok(t.scrivi('PUT', `${P}/piatti/altrui-g/visibilita`, { visibilita: 'pubblica' }))
    expect(await ids(bruno, '?famiglia=rossi&pubbliche=si')).toEqual(['altrui-g', 'altrui-rossi', 'di-rossi'])
    // Anna con i Rossi attivi: la ricetta della Famiglia di prova appare solo perché pubblica.
    const l = await ok<{ id: string; soloPubblica: boolean }[]>(anna.leggi(`${P}/piatti?famiglia=rossi&pubbliche=si`))
    expect(l.find((p) => p.id === 'altrui-g')?.soloPubblica).toBe(true)
  })
})

describe('menù: una ricetta di un\'altra Famiglia entra come copia', () => {
  it('copia privata nella Famiglia dell\'evento, riusata; personali e della stessa Famiglia collegate direttamente', async () => {
    const ev = await ok(anna.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 4, bambini: 0, note: '', gruppoId: G }))
    const p = ev.portate[0].id
    await ok(anna.scrivi('POST', `${P}/eventi/ev/voci`, {
      voci: [
        { id: 'v1', portataId: p, nome: 'Polenta', piattoId: 'di-rossi' },
        { id: 'v2', portataId: p, nome: 'Ancora polenta', piattoId: 'di-rossi' },
        { id: 'v3', portataId: p, nome: 'Torta', piattoId: 'personale' },
        { id: 'v4', portataId: p, nome: 'Ragù', piattoId: 'di-g' },
      ],
    }))
    const voci = Object.fromEntries(tutti<{ id: string; piatto_id: string }>(t.db, "SELECT id, piatto_id FROM voci_menu WHERE evento_id = 'ev'").map((v) => [v.id, v.piatto_id]))
    expect(voci.v1).not.toBe('di-rossi')
    expect(voci.v2).toBe(voci.v1)
    expect([voci.v3, voci.v4]).toEqual(['personale', 'di-g'])
    const copia = await ok(anna.leggi(`${P}/piatti/${voci.v1}`))
    expect(copia).toMatchObject({ mio: true, visibilita: 'privata', famigliaOrigine: { id: G }, provenienza: { titolo: 'Polenta', famiglia: 'Famiglia Rossi', piattoId: 'di-rossi' } })
    // I membri della Famiglia di prova non arrivano alla ricetta dei Rossi tramite l'evento.
    await ok(anna.scrivi('PUT', `${P}/eventi/ev/condivisioni/${ID_AMMINISTRATORE}`, { permesso: 'lettura' }))
    expect((await t.leggi(`${P}/piatti/di-rossi`)).statusCode).toBe(404)
  })
})
