// Centro notifiche rifinito (SPEC §29.1): aggiornamenti raggruppati apribili, collegamento al
// contenuto preciso, più Famiglie, contenuti eliminati, eventi archiviati, permessi revocati,
// notifiche nate prima della migrazione 0014.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Notifica } from '../../src/contratto/famiglia.ts'
import { esegui } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
let bruno: ClientDiProva & { id: string }
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const notifiche = async (c: ClientDiProva = t) => corpo(await c.leggi(`${P}/notifiche`)) as Notifica[]
const messaggio = (c: ClientDiProva, id: string, testo: string, gruppo = G) => ok(c.scrivi('POST', `${P}/gruppi/${gruppo}/messaggi`, { id, testo }))

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
})
afterEach(() => t.chiudi())

describe('notifiche raggruppate', () => {
  it('si aprono: chi, cosa e quando di ogni aggiornamento, ognuno con il suo messaggio', async () => {
    await messaggio(anna, 'm1', 'Domenica pranzo da noi?')
    await messaggio(bruno, 'm2', 'Porto il vino')
    await messaggio(anna, 'm3', 'Alle 13')
    const [n, ...altre] = await notifiche()
    expect(altre).toEqual([])
    expect(n).toMatchObject({ tipo: 'bacheca_famiglia', titolo: 'Famiglia', conteggio: 3, attore: 'Anna', testo: 'Alle 13', collegamento: `/famiglia?famiglia=${G}&messaggio=m3` })
    expect(n!.dettagli.map((d) => [d.attore, d.testo, d.collegamento])).toEqual([
      ['Anna', 'Alle 13', `/famiglia?famiglia=${G}&messaggio=m3`],
      ['Bruno', 'Porto il vino', `/famiglia?famiglia=${G}&messaggio=m2`],
      ['Anna', 'Domenica pranzo da noi?', `/famiglia?famiglia=${G}&messaggio=m1`],
    ])
    expect(n!.dettagli[0]!.il).toBeGreaterThanOrEqual(n!.dettagli[2]!.il)
    // Una notifica sola non ha elenco; dopo la lettura il gruppo successivo riparte da capo.
    await ok(t.scrivi('POST', `${P}/notifiche/lette`, {}))
    await messaggio(bruno, 'm4', 'Ci sono anch\'io')
    const nuove = (await notifiche()).filter((x) => !x.letta)
    expect(nuove).toEqual([expect.objectContaining({ conteggio: 1, dettagli: [] })])
  })

  it('si conservano gli ultimi 10 aggiornamenti; il conteggio resta quello vero', async () => {
    for (let i = 1; i <= 12; i++) await messaggio(anna, `m${i}`, `Messaggio ${i}`)
    const [n] = await notifiche()
    expect(n).toMatchObject({ conteggio: 12 })
    expect(n!.dettagli).toHaveLength(10)
    expect(n!.dettagli[0]!.testo).toBe('Messaggio 12')
    expect(n!.dettagli[9]!.testo).toBe('Messaggio 3')
  })

  it('notifiche nate prima della 0014: senza elenco finché non arriva un nuovo aggiornamento', async () => {
    await messaggio(anna, 'm1', 'Primo')
    await messaggio(anna, 'm2', 'Secondo')
    // Come una notifica raggruppata registrata prima della migrazione: niente dettagli.
    esegui(t.db, 'UPDATE notifiche SET dettagli = NULL')
    expect((await notifiche())[0]).toMatchObject({ conteggio: 2, dettagli: [], collegamento: `/famiglia?famiglia=${G}&messaggio=m2` })
    await messaggio(bruno, 'm3', 'Terzo')
    // L'elenco comincia dall'ultimo aggiornamento noto.
    expect((await notifiche())[0]!.dettagli.map((d) => [d.attore, d.testo])).toEqual([
      ['Bruno', 'Terzo'],
      ['Anna', 'Secondo'],
    ])
  })
})

describe('apertura del contenuto', () => {
  it('chi porta: l\'incarico preciso; l\'evento archiviato resta consultabile', async () => {
    const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2026-12-20', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '', gruppoId: G }))
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-vino', nome: 'Vino', prendo: true }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-pane', nome: 'Pane' }))
    const [n] = await notifiche()
    expect(n).toMatchObject({ tipo: 'incarico', titolo: 'Pranzo', famiglia: 'Famiglia', conteggio: 2, collegamento: '/eventi/ev/chi-porta?incarico=cosa%3Ac-pane' })
    expect(n!.dettagli.map((d) => [d.testo, d.collegamento])).toEqual([
      ['Da portare: «Pane»', '/eventi/ev/chi-porta?incarico=cosa%3Ac-pane'],
      ['Anna porta «Vino»', '/eventi/ev/chi-porta?incarico=cosa%3Ac-vino'],
    ])
    // Il messaggio sulla bacheca dell'evento porta al messaggio; archiviato l'evento, resta.
    await ok(anna.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'me', testo: 'Arrivo alle 12' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: ev.versione }))
    const dopo = await notifiche()
    expect(dopo.find((x) => x.tipo === 'bacheca_evento')).toMatchObject({ collegamento: '/eventi/ev/bacheca?messaggio=me' })
    expect((await t.leggi(`${P}/eventi/ev/bacheca`)).statusCode).toBe(200)
  })

  it('un messaggio eliminato toglie la sua notifica; un accesso revocato le toglie tutte, senza rivelare nulla', async () => {
    await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Cena segreta', data: '2026-12-20', oraServizio: '20:00', tipo: 'cena', occasione: '', adulti: 4, bambini: 0, note: '', gruppoId: G }))
    await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'modifica' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'me1', testo: 'Chi porta il dolce?' }))
    const bacheca = async () => (await notifiche(anna)).filter((x) => x.tipo === 'bacheca_evento')
    expect((await bacheca()).map((x) => x.titolo)).toEqual(['Cena segreta'])
    const m = await ok(t.leggi(`${P}/messaggi/me1`))
    await ok(t.scrivi('DELETE', `${P}/messaggi/me1?versione=${m.versione}`))
    expect(await bacheca()).toEqual([])
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'me2', testo: 'Menù deciso' }))
    expect(await bacheca()).toHaveLength(1)
    await ok(t.scrivi('DELETE', `${P}/eventi/ev/condivisioni/${anna.id}`))
    expect(await notifiche(anna)).toEqual([])
    expect(JSON.stringify(await notifiche(anna))).not.toContain('Cena segreta')
  })

  it('più Famiglie: ogni notifica porta alla sua Famiglia; uscendo dalla Famiglia sparisce', async () => {
    esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Cugini', 1, 1)")
    esegui(t.db, `INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('altra', '${anna.id}', 'amministratore', 1), ('altra', 'utente-amministratore', 'membro', 1)`)
    await messaggio(anna, 'mf', 'Nella Famiglia', G)
    await messaggio(anna, 'mc', 'Fra i cugini', 'altra')
    const l = await notifiche()
    expect(l.map((x) => [x.titolo, x.famiglia, x.conteggio, x.collegamento]).sort()).toEqual([
      ['Cugini', 'Cugini', 1, '/famiglia?famiglia=altra&messaggio=mc'],
      ['Famiglia', 'Famiglia', 1, `/famiglia?famiglia=${G}&messaggio=mf`],
    ])
    await ok(t.scrivi('POST', `${P}/famiglie/altra/esci`, {}))
    expect((await notifiche()).map((x) => x.titolo)).toEqual(['Famiglia'])
  })
})
