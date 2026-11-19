// Memoria di famiglia (SPEC §40): storia del proprietario (pubblicabile), ricordi ed esperienze dei
// familiari con autore e data, foto con le stesse regole, nulla di privato nelle pubbliche, copie
// con una memoria nuova.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaMemoriaRicetta } from '../../src/contratto/memoria.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // stessa Famiglia, membro
let bruno: ClientDiProva & { id: string } // altra Famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const jpeg = (n = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n), Buffer.from([0xff, 0xd9])])
const foto = (c: ClientDiProva, memoriaId: string, id: string) =>
  t.inietta({ method: 'POST', url: `${P}/memorie/${memoriaId}/foto?id=${id}&didascalia=Nonna`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg', cookie: c.cookie! }, payload: jpeg() })
const memoria = async (c: ClientDiProva) => SchemaMemoriaRicetta.parse(await ok(c.leggi(`${P}/piatti/ragu/memoria`)))

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno', 'utente', false)
  await ok(bruno.scrivi('POST', `${P}/famiglie`, { id: 'bianchi', nome: 'Famiglia Bianchi' }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'ragu', nome: 'Ragù della nonna', famiglie: [G] }))
})
afterEach(() => t.chiudi())

describe('memoria di famiglia', () => {
  it('storia del proprietario; ricordi ed esperienze dei familiari con autore e data; ognuno modifica i suoi', async () => {
    await ok(t.scrivi('PUT', `${P}/piatti/ragu/storia`, { testo: 'La faceva nonna Lina la domenica.', pubblica: false }))
    expect((await anna.scrivi('PUT', `${P}/piatti/ragu/storia`, { testo: 'No', pubblica: false })).statusCode).toBe(403)
    const r = await ok(anna.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'm1', tipo: 'ricordo', testo: 'Il profumo in tutta la casa' }))
    expect(r).toMatchObject({ tipo: 'ricordo', autore: { id: anna.id, nome: 'Anna' }, puoModificare: true, puoEliminare: true })
    const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale 2026', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '', gruppoId: G }))
    expect(ev.id).toBe('ev')
    await ok(t.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'm2', tipo: 'esperienza', testo: 'Con 1,5 kg di carne per 12: avanzato poco', eventoId: 'ev' }))
    const vista = await memoria(anna)
    expect(vista.storia).toMatchObject({ testo: 'La faceva nonna Lina la domenica.', puoModificare: false })
    expect(vista.ricordi.map((m) => [m.testo, m.autore.nome])).toEqual([['Il profumo in tutta la casa', 'Anna']])
    // Anna non vede l'evento: l'esperienza c'è, l'evento non si nomina.
    expect(vista.esperienze).toEqual([expect.objectContaining({ testo: 'Con 1,5 kg di carne per 12: avanzato poco', evento: null, puoModificare: false, puoEliminare: false })])
    expect((await memoria(t)).esperienze[0]!.evento).toEqual({ id: 'ev', nome: 'Natale 2026' })
    // Nessuno modifica i ricordi altrui; l'amministratore della Famiglia può toglierli.
    expect((await t.scrivi('PUT', `${P}/memorie/m1`, { testo: 'Cambiato', versione: 1 })).statusCode).toBe(403)
    expect((await anna.scrivi('DELETE', `${P}/memorie/m2?versione=1`)).statusCode).toBe(403)
    await ok(anna.scrivi('PUT', `${P}/memorie/m1`, { testo: 'Il profumo del soffritto in tutta la casa', versione: 1 }))
    await ok(t.scrivi('DELETE', `${P}/memorie/m1?versione=2`))
    expect((await memoria(anna)).ricordi).toEqual([])
    // Le esperienze non toccano la ricetta.
    expect((await ok(t.leggi(`${P}/piatti/ragu`))).versione).toBe(1)
  })

  it('fuori dalla Famiglia: niente memoria; con la ricetta pubblica solo la storia pubblicata, mai ricordi o loro foto', async () => {
    await ok(t.scrivi('PUT', `${P}/piatti/ragu/storia`, { testo: 'Storia di famiglia', pubblica: false }))
    await ok(anna.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'm1', tipo: 'ricordo', testo: 'Ricordo privato' }))
    expect((await foto(anna, 'm1', 'f-ricordo')).statusCode).toBe(201)
    expect((await bruno.leggi(`${P}/piatti/ragu/memoria`)).statusCode).toBe(404)
    expect((await bruno.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'mx', tipo: 'ricordo', testo: 'Intruso' })).statusCode).toBe(404)
    await ok(t.scrivi('PUT', `${P}/piatti/ragu/visibilita`, { visibilita: 'pubblica' }))
    let v = await memoria(bruno)
    expect(v).toMatchObject({ storia: null, ricordi: [], esperienze: [], puoContribuire: false, soloPubblica: true })
    expect((await bruno.leggi(`${P}/foto/f-ricordo`)).statusCode).toBe(404)
    expect((await bruno.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'mx', tipo: 'ricordo', testo: 'Intruso' })).statusCode).toBe(403)
    // La storia si pubblica solo esplicitamente, con le sue foto.
    const storia = (await ok(t.scrivi('PUT', `${P}/piatti/ragu/storia`, { testo: 'Storia di famiglia', pubblica: true, versione: 1 }))).storia
    expect((await foto(t, storia.id, 'f-storia')).statusCode).toBe(201)
    v = await memoria(bruno)
    expect(v.storia).toMatchObject({ testo: 'Storia di famiglia', pubblica: true, foto: [expect.objectContaining({ id: 'f-storia' })] })
    expect((await bruno.leggi(`${P}/foto/f-storia`)).statusCode).toBe(200)
    expect(v.ricordi).toEqual([])
    // Anonimi: niente.
    for (const url of ['/piatti/ragu/memoria', '/foto/f-storia', '/foto/f-ricordo']) expect((await t.anonimo.leggi(`${P}${url}`)).statusCode).toBe(401)
  })

  it('foto dei ricordi: dell\'autore, fuori dalla galleria della ricetta e dalle copie; la copia inizia una memoria nuova', async () => {
    await ok(t.scrivi('PUT', `${P}/piatti/ragu/storia`, { testo: 'Storia', pubblica: false }))
    await ok(anna.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'm1', tipo: 'ricordo', testo: 'Pranzo del 1987' }))
    expect((await foto(t, 'm1', 'f-altrui')).statusCode).toBe(403)
    expect((await foto(anna, 'm1', 'f1')).statusCode).toBe(201)
    const ricetta = await ok(t.leggi(`${P}/piatti/ragu`))
    expect(ricetta.foto).toEqual([])
    // Una foto di un ricordo non diventa la foto della ricetta.
    expect((await anna.scrivi('PUT', `${P}/foto/f1`, { didascalia: 'x', principale: true, passo: null, versione: 1 })).statusCode).toBe(422)
    expect((await t.scrivi('DELETE', `${P}/foto/f1?versione=1`)).statusCode).toBe(403)
    // Copia in un'altra Famiglia: provenienza sì, memoria no.
    await ok(t.scrivi('POST', `${P}/famiglie`, { id: 'mia', nome: 'Mia' }))
    await ok(t.scrivi('POST', `${P}/piatti/ragu/copia-in-famiglia`, { id: 'copia', gruppoId: 'mia' }))
    const c = await ok(t.leggi(`${P}/piatti/copia/memoria`))
    expect(c).toMatchObject({ storia: null, ricordi: [], esperienze: [] })
    expect((await ok(t.leggi(`${P}/piatti/copia`))).provenienza).toMatchObject({ titolo: 'Ragù della nonna' })
    // Eliminare il ricordo elimina le sue foto.
    await ok(anna.scrivi('DELETE', `${P}/memorie/m1?versione=1`))
    expect((await anna.leggi(`${P}/foto/f1`)).statusCode).toBe(404)
  })

  it('esportazione e ripristino conservano la memoria', async () => {
    await ok(anna.scrivi('POST', `${P}/piatti/ragu/memorie`, { id: 'm1', tipo: 'ricordo', testo: 'Da conservare' }))
    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    await ok(anna.scrivi('DELETE', `${P}/memorie/m1?versione=1`))
    const v = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: v.token, conferma: 'RIPRISTINA' }))
    expect((await memoria(anna)).ricordi.map((m) => m.testo)).toEqual(['Da conservare'])
  })
})
