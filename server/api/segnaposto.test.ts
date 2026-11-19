// Segnaposto (SPEC §42): proposta dai partecipanti, salvataggio con versione accanto allo stile del
// menù senza toccarlo, archivio, duplicazione, esportazione e ripristino.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaSegnaposto } from '../../src/contratto/segnaposto.ts'
import { segnapostoPredefiniti } from '../../src/domain/segnaposto.ts'
import { opzioniPredefinite } from '../../src/domain/stampa.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
  await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale 2026', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 2, note: '' }))
})
afterEach(() => t.chiudi())

const P = '/api/v1'
const URL = `${P}/eventi/ev/segnaposto`
const corpo = (r: { body: string }) => JSON.parse(r.body)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const leggi = async (id = 'ev') => SchemaSegnaposto.parse(await ok(t.leggi(`${P}/eventi/${id}/segnaposto`)))
const nome = (id: string, testo: string, extra: Record<string, unknown> = {}) => ({ id, testo, stampa: true, copie: 1, ...extra })

describe('segnaposto', () => {
  it('senza partecipanti: elenco vuoto, cavalletto con seconda faccia, stile del menù', async () => {
    const s = await leggi()
    expect(s).toMatchObject({ salvati: false, versione: 0, nomiPartecipanti: [] })
    expect(s.opzioni).toEqual(segnapostoPredefiniti())
    expect(s.stileMenu).toEqual({ modello: 'natale', palette: 'natale', caratteri: 'calligrafica', decorazioni: true })
  })

  it('propone i partecipanti con nome (non gli assenti); salvati, restano indipendenti', async () => {
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'p1', nome: 'Nonna Lù', stato: 'confermato' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'a1', invitoId: 'p1', nome: "Nonno D'Angelo", categoria: 'adulto', stato: 'in_attesa' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'p2', nome: 'Zio Piero', stato: 'assente' }))
    const s = await leggi()
    expect(s.nomiPartecipanti).toEqual(['Nonna Lù', "Nonno D'Angelo"])
    expect(s.opzioni.nomi.map((n) => n.testo)).toEqual(['Nonna Lù', "Nonno D'Angelo"])

    const opzioni = { ...s.opzioni, nomi: [nome('n1', '  Nonna Lù  ', { copie: 2 }), nome('n2', 'Ospite', { stampa: false })], mostraEvento: true, testoEvento: '  ', formato: 'piatto' as const }
    const salvato = SchemaSegnaposto.parse(await ok(t.scrivi('PUT', URL, { opzioni, versione: 0 })))
    expect(salvato).toMatchObject({ salvati: true, versione: 1 })
    expect(salvato.opzioni).toMatchObject({ formato: 'piatto', testoEvento: null, mostraEvento: true, nomi: [{ testo: 'Nonna Lù', copie: 2 }, { testo: 'Ospite', stampa: false }] })
    // Un partecipante nuovo è solo proposto: i segnaposto salvati non cambiano.
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'p4', nome: 'Cugina Ada', stato: 'confermato' }))
    const dopo = await leggi()
    expect(dopo.opzioni).toEqual(salvato.opzioni)
    expect(dopo.nomiPartecipanti).toContain('Cugina Ada')
    // E i partecipanti non cambiano per i segnaposto.
    expect(corpo(await t.leggi(`${P}/eventi/ev/partecipanti`)).inviti.map((i: { nome: string }) => i.nome)).toEqual(['Nonna Lù', 'Zio Piero', 'Cugina Ada'])
  })

  it('menù e segnaposto si salvano senza toccarsi; la versione è una sola', async () => {
    const menu = { ...opzioniPredefinite({ occasione: 'Natale', nome: '' }), modello: 'rustico', nota: 'Buone feste' } as const
    await ok(t.scrivi('PUT', `${P}/eventi/ev/stampa`, { opzioni: menu, versione: 0 }))
    const stile = { modello: 'elegante', palette: 'notte', caratteri: 'garamond', decorazioni: false } as const
    const s = SchemaSegnaposto.parse(await ok(t.scrivi('PUT', URL, { opzioni: { ...segnapostoPredefiniti([nome('n1', 'Anna')]), stile }, versione: 1 })))
    expect(s.versione).toBe(2)
    expect(s.stileMenu.modello).toBe('rustico')
    // Il menù non vede i segnaposto e non li perde quando si salva.
    const m = corpo(await t.leggi(`${P}/eventi/ev/stampa`))
    expect(m.opzioni).toEqual({ ...menu, titolo: null })
    await ok(t.scrivi('PUT', `${P}/eventi/ev/stampa`, { opzioni: { ...menu, modello: 'festivo' }, versione: 2 }))
    const dopo = await leggi()
    expect(dopo.opzioni.stile).toEqual(stile)
    expect(dopo.opzioni.nomi.map((n) => n.testo)).toEqual(['Anna'])
    expect(dopo.stileMenu.modello).toBe('festivo')
    // Versione vecchia: 409 con i segnaposto attuali.
    const conflitto = await t.scrivi('PUT', URL, { opzioni: segnapostoPredefiniti(), versione: 2 })
    expect(conflitto.statusCode).toBe(409)
    expect(corpo(conflitto).errore.dettagli.attuale).toMatchObject({ versione: 3, opzioni: { stile } })
  })

  it('valida nomi, copie e testi', async () => {
    const base = segnapostoPredefiniti()
    for (const opzioni of [
      { ...base, formato: 'biglietto' },
      { ...base, nomi: [nome('n1', 'x'.repeat(61))] },
      { ...base, nomi: [nome('n1', 'Anna', { copie: 0 })] },
      { ...base, nomi: [nome('n1', 'Anna', { copie: 21 })] },
      { ...base, testoEvento: 'x'.repeat(81) },
      { ...base, stile: { modello: 'barocco', palette: 'natale', caratteri: 'classica', decorazioni: true } },
    ]) {
      expect((await t.scrivi('PUT', URL, { opzioni, versione: 0 })).statusCode).toBe(400)
    }
  })

  it('archivio: fotografati e in sola lettura; duplicazione con le impostazioni di stampa; esportazione e ripristino', async () => {
    const opzioni = { ...segnapostoPredefiniti([nome('n1', 'Élise'), nome('n2', 'Gianmaria Bartolomeo')]), mostraEvento: true, testoEvento: 'Natale in famiglia' }
    await ok(t.scrivi('PUT', URL, { opzioni, versione: 0 }))
    const ev = corpo(await t.leggi(`${P}/eventi/ev`))
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: ev.versione }))
    const archiviato = await leggi()
    expect(archiviato.opzioni).toEqual(opzioni)
    expect((await t.scrivi('PUT', URL, { opzioni: segnapostoPredefiniti(), versione: archiviato.versione })).statusCode).toBe(422)

    await ok(t.scrivi('POST', `${P}/eventi/ev/duplica`, { id: 'ev2', nome: 'Natale 2027', data: '2027-12-25' }))
    expect((await leggi('ev2')).opzioni).toEqual(opzioni)

    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    await ok(t.scrivi('PUT', `${P}/eventi/ev2/segnaposto`, { opzioni: segnapostoPredefiniti(), versione: 1 }))
    const v = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: v.token, conferma: 'RIPRISTINA' }))
    expect((await leggi('ev2')).opzioni).toEqual(opzioni)
  })
})
