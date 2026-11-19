// Ricette pubbliche fra Famiglie (SPEC §36, piano di evoluzione fase 1B): pubblicazione solo del
// proprietario e con la Famiglia d'origine, lettura per ogni utente con sessione e mai per gli
// anonimi (foto comprese), isolamento delle ricette non pubbliche, nessun doppione, copie private e
// indipendenti, uso nei menù tramite copia riusata, preferenza personale, migrazione 0017.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, tutti, uno } from '../db/connessione.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // stessa Famiglia dell'autore
let bruno: ClientDiProva & { id: string } // un'altra Famiglia
let carla: ClientDiProva & { id: string } // nessuna Famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7), Buffer.from([0xff, 0xd9])])
const elenco = async (c: ClientDiProva, pubbliche?: 'si' | 'solo') =>
  (await ok<{ id: string; visibilita: string; soloPubblica: boolean }[]>(c.leggi(`${P}/piatti${pubbliche ? `?pubbliche=${pubbliche}` : ''}`)))
const ids = async (c: ClientDiProva, pubbliche?: 'si' | 'solo') => (await elenco(c, pubbliche)).map((p) => p.id)
const visibilita = (c: ClientDiProva, id: string, v: string) => c.scrivi('PUT', `${P}/piatti/${id}/visibilita`, { visibilita: v })

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno', 'utente', false)
  carla = t.utente('Carla', 'utente', false)
  await ok(bruno.scrivi('POST', `${P}/famiglie`, { id: 'bianchi', nome: 'Famiglia Bianchi' }))
  // L'autore (amministratore di prova) ha un ragù di famiglia con una foto, un pesto privato e un tiramisù di famiglia.
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'ragu', nome: 'Ragù della nonna', porzioniBase: 4, procedimento: ['Rosolare'], ingredienti: [] }))
  await ok(t.inietta({ method: 'POST', url: `${P}/piatti/ragu/foto?id=f-ragu`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: jpeg }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'pesto', nome: 'Pesto', visibilita: 'privata' }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'tiramisu', nome: 'Tiramisù' }))
})
afterEach(() => t.chiudi())

describe('pubblicazione', () => {
  it('nessuna ricetta è pubblica finché il proprietario non lo decide; solo lui, con la Famiglia d\'origine', async () => {
    expect(await ids(bruno, 'si')).toEqual([])
    expect((await bruno.leggi(`${P}/piatti/ragu`)).statusCode).toBe(404)
    // Né un altro membro della Famiglia né un estraneo possono pubblicarla.
    expect((await visibilita(anna, 'ragu', 'pubblica')).statusCode).toBe(403)
    expect((await visibilita(bruno, 'ragu', 'pubblica')).statusCode).toBe(404)
    // Senza Famiglia d'origine non si pubblica (né dall'API né nel database).
    esegui(t.db, "UPDATE piatti SET famiglia_origine_id = NULL WHERE id = 'pesto'")
    const senza = await ok(carla.scrivi('POST', `${P}/piatti`, { id: 'di-carla', nome: 'Torta di Carla' }))
    expect(senza.famigliaOrigine).toBeNull()
    expect(corpo(await visibilita(carla, 'di-carla', 'pubblica')).errore.dettagli.regola).toBe('origine_mancante')
    expect(() => esegui(t.db, "UPDATE piatti SET pubblica = 1 WHERE id = 'di-carla'")).toThrow(/senza Famiglia d'origine/)
    const scheda = await ok(visibilita(t, 'ragu', 'pubblica'))
    // Proprietà, origine e condivisione con la Famiglia non cambiano.
    expect(scheda).toMatchObject({ visibilita: 'pubblica', mio: true, famigliaOrigine: { id: G }, famiglie: [{ id: G }], soloPubblica: false })
  })

  it('una privata resa pubblica entra anche nella sua Famiglia; «di famiglia» toglie la pubblicazione, «privata» tutto', async () => {
    await ok(visibilita(t, 'pesto', 'pubblica'))
    expect(await ok(t.leggi(`${P}/piatti/pesto`))).toMatchObject({ visibilita: 'pubblica', famiglie: [{ id: G }] })
    await ok(visibilita(t, 'pesto', 'famiglia'))
    expect(await ok(t.leggi(`${P}/piatti/pesto`))).toMatchObject({ visibilita: 'famiglia', famiglie: [{ id: G }] })
    expect(await ids(bruno, 'si')).toEqual([])
    await ok(visibilita(t, 'pesto', 'pubblica'))
    await ok(t.scrivi('PUT', `${P}/piatti/pesto/famiglie`, { gruppi: [] }))
    expect(await ok(t.leggi(`${P}/piatti/pesto`))).toMatchObject({ visibilita: 'privata', famiglie: [] })
    expect(await ids(bruno, 'si')).toEqual([])
  })
})

describe('lettura e isolamento', () => {
  beforeEach(async () => {
    await ok(visibilita(t, 'ragu', 'pubblica'))
  })

  it('chi ha una sessione la legge in sola lettura, foto ed esportazione comprese; il resto della Famiglia resta chiuso', async () => {
    for (const c of [bruno, carla]) {
      expect(await ids(c)).not.toContain('ragu')
      expect(await ids(c, 'si')).toEqual(['ragu'])
      expect(await ids(c, 'solo')).toEqual(['ragu'])
      expect(await ok(c.leggi(`${P}/piatti/ragu`))).toMatchObject({ mio: false, soloPubblica: true, visibilita: 'pubblica', famigliaOrigine: { nome: 'Famiglia' }, miaCopia: null })
      expect((await c.leggi(`${P}/foto/f-ragu`)).statusCode).toBe(200)
      expect((await c.leggi(`${P}/piatti/ragu/esporta`)).statusCode).toBe(200)
      // Le ricette non pubbliche della stessa Famiglia restano invisibili.
      for (const id of ['pesto', 'tiramisu']) expect((await c.leggi(`${P}/piatti/${id}`)).statusCode).toBe(404)
      // Sola lettura.
      const r = await ok(c.leggi(`${P}/piatti/ragu`))
      expect((await c.scrivi('PUT', `${P}/piatti/ragu`, { ...r, nome: 'Mio' })).statusCode).toBe(403)
      expect((await c.scrivi('DELETE', `${P}/piatti/ragu?versione=${r.versione}`)).statusCode).toBe(403)
      expect((await c.scrivi('PUT', `${P}/foto/f-ragu`, { didascalia: 'x', principale: true, passo: null, versione: 1 })).statusCode).toBe(403)
    }
  })

  it('anonimi: niente elenco, scheda, foto o esportazione', async () => {
    for (const url of ['/piatti', '/piatti?pubbliche=solo', '/piatti/ragu', '/foto/f-ragu', '/piatti/ragu/esporta']) {
      expect((await t.anonimo.leggi(`${P}${url}`)).statusCode, url).toBe(401)
    }
  })

  it('nella propria Famiglia una pubblica compare una volta sola, come ricetta di famiglia', async () => {
    const mie = (await elenco(anna, 'si')).filter((p) => p.id === 'ragu')
    expect(mie).toEqual([expect.objectContaining({ visibilita: 'pubblica', soloPubblica: false })])
    expect((await elenco(anna, 'solo')).map((p) => p.id)).toEqual(['ragu'])
  })
})

describe('copia', () => {
  beforeEach(async () => {
    await ok(visibilita(t, 'ragu', 'pubblica'))
  })

  it('in una mia Famiglia: privata, mia, modificabile, con provenienza e foto proprie; resta se l\'originale cambia o sparisce', async () => {
    expect((await bruno.scrivi('POST', `${P}/piatti/ragu/copia-in-famiglia`, { id: 'c', gruppoId: G })).statusCode).toBe(404)
    await ok(bruno.scrivi('POST', `${P}/piatti/ragu/copia-in-famiglia`, { id: 'c', gruppoId: 'bianchi' }))
    const c = await ok(bruno.leggi(`${P}/piatti/c`))
    expect(c).toMatchObject({
      mio: true,
      visibilita: 'privata',
      famiglie: [],
      famigliaOrigine: { id: 'bianchi', nome: 'Famiglia Bianchi' },
      provenienza: { titolo: 'Ragù della nonna', famiglia: 'Famiglia', copiataDa: 'Bruno', piattoId: 'ragu' },
      procedimento: ['Rosolare'],
      originePiattoId: null,
    })
    expect(c.foto).toHaveLength(1)
    expect(c.foto[0].id).not.toBe('f-ragu')
    expect((await ok(bruno.leggi(`${P}/piatti/ragu`))).miaCopia).toBe('c')
    await ok(bruno.scrivi('PUT', `${P}/piatti/c`, { ...c, nome: 'Ragù di Bruno' }))
    // La copia si può poi condividere con la Famiglia o pubblicare.
    await ok(visibilita(bruno, 'c', 'pubblica'))
    expect((await ok(carla.leggi(`${P}/piatti/c`))).famigliaOrigine.nome).toBe('Famiglia Bianchi')
    // L'originale torna privato, poi sparisce: la copia resta com'è, foto compresa.
    await ok(visibilita(t, 'ragu', 'privata'))
    expect((await bruno.leggi(`${P}/piatti/ragu`)).statusCode).toBe(404)
    const orig = await ok(t.leggi(`${P}/piatti/ragu`))
    await ok(t.scrivi('DELETE', `${P}/piatti/ragu?versione=${orig.versione}`))
    const dopo = await ok(bruno.leggi(`${P}/piatti/c`))
    expect(dopo).toMatchObject({ nome: 'Ragù di Bruno', procedimento: ['Rosolare'] })
    expect((await bruno.leggi(`${P}/foto/${dopo.foto[0].id}`)).statusCode).toBe(200)
  })

  it('nel menù: collegarla ne fa una copia privata nella Famiglia dell\'evento, riusata le volte dopo', async () => {
    const ev = await ok(bruno.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Cena', data: '2030-01-10', oraServizio: null, tipo: 'cena', occasione: '', adulti: 4, bambini: 0, note: '', gruppoId: 'bianchi' }))
    await ok(bruno.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: ev.portate[0].id, nome: 'Ragù', piattoId: 'ragu' }, { id: 'v2', portataId: ev.portate[1].id, nome: 'Ancora ragù', piattoId: 'ragu' }] }))
    const voci = tutti<{ piatto_id: string }>(t.db, "SELECT piatto_id FROM voci_menu WHERE evento_id = 'ev' ORDER BY id")
    expect(voci[0]!.piatto_id).not.toBe('ragu')
    expect(voci[1]!.piatto_id).toBe(voci[0]!.piatto_id)
    const copia = await ok(bruno.leggi(`${P}/piatti/${voci[0]!.piatto_id}`))
    expect(copia).toMatchObject({ mio: true, visibilita: 'privata', famigliaOrigine: { id: 'bianchi' }, provenienza: { piattoId: 'ragu' } })
    // Già copiata: «Copia nel mio ricettario» o un nuovo collegamento la riconoscono.
    expect((await ok(bruno.leggi(`${P}/piatti/ragu`))).miaCopia).toBe(copia.id)
  })
})

describe('preferenza «Includi ricette pubbliche»', () => {
  it('spenta all\'inizio, personale, con controllo di versione', async () => {
    expect(await ok(bruno.leggi(`${P}/account/preferenze`))).toEqual({ includiPubbliche: false, versione: 0 })
    const p = await ok(bruno.scrivi('PUT', `${P}/account/preferenze`, { includiPubbliche: true, versione: 0 }))
    expect(p).toEqual({ includiPubbliche: true, versione: 1 })
    expect((await bruno.scrivi('PUT', `${P}/account/preferenze`, { includiPubbliche: false, versione: 0 })).statusCode).toBe(409)
    expect(await ok(carla.leggi(`${P}/account/preferenze`))).toEqual({ includiPubbliche: false, versione: 0 })
    expect((await t.anonimo.leggi(`${P}/account/preferenze`)).statusCode).toBe(401)
  })
})

describe('migrazione 0017', () => {
  it('nessuna ricetta diventa pubblica; preferenze vuote', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0017-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 16 })
      esegui(db, "INSERT INTO piatti (id, nome, nome_norm, proprietario_id, creato_il, aggiornato_il) VALUES ('p', 'P', 'p', 'utente-amministratore', 1, 1)")
      await applicaMigrazioni(db, { cartellaBackup: null })
      expect(uno(db, 'SELECT pubblica FROM piatti')).toEqual({ pubblica: 0 })
      expect(tutti(db, 'SELECT * FROM preferenze_utente')).toEqual([])
      expect(tutti(db, 'PRAGMA foreign_key_check')).toEqual([])
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})
