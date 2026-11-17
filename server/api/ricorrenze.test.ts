// Ricorrenze e copia delle ricette fra Famiglie (SPEC §28): anagrafica per Famiglia,
// associazione facoltativa, duplicazione, confronto anche fra edizioni non consecutive; copie
// indipendenti con foto e provenienza descrittiva; permessi, privacy, backup e migrazione 0013.
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaDettaglioPiatto } from '../../src/contratto/ricettario.ts'
import { apriDatabase, chiudiDatabase, esegui, tutti, uno } from '../db/connessione.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, type ClientDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva // Loris, amministratore della Famiglia
let anna: ClientDiProva & { id: string } // membro della Famiglia e dei Rossi
let carla: ClientDiProva & { id: string } // solo dei Rossi
let estraneo: ClientDiProva & { id: string } // nessuna Famiglia in comune
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const regola = async (r: Promise<{ statusCode: number; body: string }>) => corpo(await r).errore?.dettagli?.regola
const evento = (c: ClientDiProva, id: string, data: string, gruppoId: string | null = G) =>
  ok(c.scrivi('POST', `${P}/eventi`, { id, nome: `Natale ${data.slice(0, 4)}`, data, oraServizio: null, tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 0, note: '', gruppoId }))
const ricorrenza = (c: ClientDiProva, id: string, nome: string, gruppo = G) => c.scrivi('POST', `${P}/famiglie/${gruppo}/ricorrenze`, { id, nome })
const associa = (c: ClientDiProva, eventoId: string, ricorrenzaId: string | null) => c.scrivi('PUT', `${P}/eventi/${eventoId}/ricorrenza`, { ricorrenzaId })
const jpeg = (n = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n), Buffer.from([0xff, 0xd9])])

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  carla = t.utente('Carla', 'utente', false)
  estraneo = t.utente('Estraneo', 'utente', false)
  esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('rossi', 'Famiglia Rossi', 1, 1)")
  esegui(t.db, `INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('rossi', '${anna.id}', 'amministratore', 1), ('rossi', '${carla.id}', 'membro', 1)`)
})
afterEach(() => t.chiudi())

describe('ricorrenze', () => {
  it('create, rinominate ed eliminate dai membri secondo il ruolo; nomi unici; isolate fra Famiglie', async () => {
    expect(await ok(ricorrenza(anna, 'r-natale', 'Natale'))).toMatchObject({ nome: 'Natale', eventi: 0, descrizione: '' })
    expect(await regola(ricorrenza(t, 'r-x', 'natale'))).toBe('nome_ricorrenza')
    const r = await ok(anna.scrivi('PUT', `${P}/ricorrenze/r-natale`, { nome: 'Natale dai nonni', descrizione: 'Il 25 a pranzo', versione: 1 }))
    expect(r).toMatchObject({ nome: 'Natale dai nonni', descrizione: 'Il 25 a pranzo', versione: 2 })
    expect((await ok(t.leggi(`${P}/famiglie/${G}/ricorrenze`))).map((x: { nome: string }) => x.nome)).toEqual(['Natale dai nonni'])
    // Un'altra Famiglia non le vede e può avere una ricorrenza con lo stesso nome.
    expect(await ok(carla.leggi(`${P}/famiglie/rossi/ricorrenze`))).toEqual([])
    await ok(ricorrenza(carla, 'r-rossi', 'Natale dai nonni', 'rossi'))
    for (const c of [carla, estraneo]) {
      expect((await c.leggi(`${P}/famiglie/${G}/ricorrenze`)).statusCode).toBe(404)
      expect((await c.scrivi('PUT', `${P}/ricorrenze/r-natale`, { nome: 'x', descrizione: '', versione: 2 })).statusCode).toBe(404)
      expect((await c.scrivi('DELETE', `${P}/ricorrenze/r-natale`)).statusCode).toBe(404)
    }
    // Eliminare spetta a chi amministra la Famiglia.
    expect((await anna.scrivi('DELETE', `${P}/ricorrenze/r-natale`)).statusCode).toBe(403)
    expect((await t.scrivi('DELETE', `${P}/ricorrenze/r-natale`)).statusCode).toBe(204)
    // Nessuna ricorrenza nasce da sola.
    expect(uno(t.db, 'SELECT count(*) AS n FROM ricorrenze')).toEqual({ n: 1 })
  })

  it('associazione facoltativa all\'evento; eliminare la ricorrenza lascia eventi, menù e archivi', async () => {
    await ok(ricorrenza(t, 'r-natale', 'Natale'))
    const ev = await evento(t, 'n26', '2026-12-25')
    await ok(t.scrivi('POST', `${P}/eventi/n26/voci`, { voci: [{ id: 'v1', portataId: ev.portate[1].id, nome: 'Lasagne' }] }))
    expect(corpo(await t.leggi(`${P}/eventi/n26`)).ricorrenzaId).toBeNull()
    expect((await ok(associa(t, 'n26', 'r-natale'))).ricorrenza).toEqual({ tipo: 'famiglia', id: 'r-natale', nome: 'Natale' })
    expect(corpo(await t.leggi(`${P}/eventi/n26`)).ricorrenzaId).toBe('r-natale')
    expect((await ok(t.leggi(`${P}/famiglie/${G}/ricorrenze`)))[0].eventi).toBe(1)
    expect((await ok(associa(t, 'n26', null))).ricorrenza).toBeNull()
    await ok(associa(t, 'n26', 'r-natale'))
    const e = corpo(await t.leggi(`${P}/eventi/n26`))
    await ok(t.scrivi('POST', `${P}/eventi/n26/archivia`, { versione: e.versione }))
    const snap = tutti(t.db, "SELECT * FROM snapshot_eventi WHERE evento_id = 'n26'")
    await ok(t.scrivi('DELETE', `${P}/ricorrenze/r-natale`))
    expect(corpo(await t.leggi(`${P}/eventi/n26`))).toMatchObject({ id: 'n26', ricorrenzaId: null, stato: 'archiviato' })
    expect(corpo(await t.leggi(`${P}/eventi/n26/menu`)).portate[1].voci[0].nome).toBe('Lasagne')
    expect(tutti(t.db, "SELECT * FROM snapshot_eventi WHERE evento_id = 'n26'")).toEqual(snap)
  })

  it('solo ricorrenze della Famiglia dell\'evento, da chi lo modifica e ne fa parte', async () => {
    await ok(ricorrenza(t, 'r-natale', 'Natale'))
    await ok(ricorrenza(anna, 'r-rossi', 'Natale', 'rossi'))
    await evento(t, 'n26', '2026-12-25')
    expect(await regola(associa(t, 'n26', 'r-rossi'))).toBe('ricorrenza_altra_famiglia')
    expect((await associa(t, 'n26', 'inesistente')).statusCode).toBe(404)
    // Il database impedisce comunque una ricorrenza di un'altra Famiglia.
    expect(() => esegui(t.db, "UPDATE eventi SET ricorrenza_id = 'r-rossi', ricorrenza_standard = NULL WHERE id = 'n26'")).toThrow(/altra Famiglia/)
    // Evento personale: nessuna ricorrenza.
    await evento(t, 'pers', '2026-08-15', null)
    expect(await regola(associa(t, 'pers', 'r-natale'))).toBe('evento_personale')
    // Chi legge soltanto, o non vede l'evento, non associa.
    await ok(t.scrivi('PUT', `${P}/eventi/n26/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    expect((await associa(anna, 'n26', 'r-natale')).statusCode).toBe(403)
    expect((await associa(estraneo, 'n26', 'r-natale')).statusCode).toBe(404)
    // Spostato in un'altra Famiglia, l'evento perde la ricorrenza.
    await ok(associa(t, 'n26', 'r-natale'))
    esegui(t.db, "INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('rossi', 'utente-amministratore', 'membro', 1)")
    await ok(t.scrivi('PUT', `${P}/eventi/n26/famiglia`, { gruppoId: 'rossi' }))
    expect(corpo(await t.leggi(`${P}/eventi/n26`)).ricorrenzaId).toBeNull()
  })

  it('duplicando si propone la stessa ricorrenza (cambiabile o da togliere); confronto anche fra edizioni non consecutive', async () => {
    await ok(ricorrenza(t, 'r-natale', 'Natale'))
    await ok(ricorrenza(t, 'r-cena', 'Cena tra amici'))
    await evento(t, 'n22', '2022-12-25')
    await ok(associa(t, 'n22', 'r-natale'))
    expect((await ok(t.scrivi('POST', `${P}/eventi/n22/duplica`, { id: 'n26', nome: 'Natale 2026', data: '2026-12-25' }))).evento.ricorrenzaId).toBe('r-natale')
    expect((await ok(t.scrivi('POST', `${P}/eventi/n22/duplica`, { id: 'c1', nome: 'Cena', data: '2027-03-01', ricorrenzaId: 'r-cena' }))).evento.ricorrenzaId).toBe('r-cena')
    expect((await ok(t.scrivi('POST', `${P}/eventi/n22/duplica`, { id: 'x1', nome: 'Altro', data: '2027-05-01', ricorrenzaId: null }))).evento.ricorrenzaId).toBeNull()
    // In un'altra Famiglia la ricorrenza dell'originale non vale.
    esegui(t.db, "INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('rossi', 'utente-amministratore', 'membro', 1)")
    expect((await ok(t.scrivi('POST', `${P}/eventi/n22/duplica`, { id: 'x2', nome: 'Altrove', data: '2027-05-01', gruppoId: 'rossi' }))).evento.ricorrenzaId).toBeNull()
    expect(await regola(t.scrivi('POST', `${P}/eventi/n22/duplica`, { id: 'x3', nome: 'Altrove', data: '2027-05-01', gruppoId: 'rossi', ricorrenzaId: 'r-natale' }))).toBe('ricorrenza_altra_famiglia')
    // Edizioni in ordine di data; mancano gli anni di mezzo, nessun problema.
    const ed = await ok(t.leggi(`${P}/eventi/n26/edizioni`))
    expect(ed).toMatchObject({ ricorrenza: { nome: 'Natale' }, edizioni: [{ id: 'n22', data: '2022-12-25' }], puoAssociare: true })
    expect(ed.ricorrenze.map((x: { nome: string }) => x.nome)).toEqual(['Cena tra amici', 'Natale'])
    const c = await ok(t.leggi(`${P}/eventi/n26/confronto?con=n22`))
    expect(c).toMatchObject({ ora: { nome: 'Natale 2026' }, prima: { nome: 'Natale 2022' } })
    // Senza ricorrenza: confronto manuale con un evento della stessa Famiglia.
    expect((await ok(t.leggi(`${P}/eventi/x1/edizioni`))).altriEventi.map((x: { id: string }) => x.id)).toContain('n22')
    expect((await ok(t.leggi(`${P}/eventi/x1/confronto?con=n22`))).prima.nome).toBe('Natale 2022')
  })
})

describe('copia delle ricette fra Famiglie', () => {
  async function ricettaConFoto() {
    await ok(t.scrivi('POST', `${P}/piatti`, {
      id: 'p-ragu',
      nome: 'Ragù della nonna',
      porzioniBase: 6,
      procedimento: ['Soffritto', 'Cottura lenta'],
      famiglie: [G],
      ingredienti: [{ id: 'i1', ordine: 0, testoOriginale: '500 g macinato', nome: 'macinato', ingredienteId: null, quantita: 500, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] }],
    }))
    const r = await t.inietta({ method: 'POST', url: `${P}/piatti/p-ragu/foto?id=f-ragu&didascalia=Pentola`, headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: jpeg() })
    expect(r.statusCode, r.body).toBe(201)
  }
  const copia = (c: ClientDiProva, extra: Record<string, unknown> = {}) => c.scrivi('POST', `${P}/piatti/p-ragu/copia-in-famiglia`, { id: 'c-ragu', gruppoId: 'rossi', ...extra })

  it('copia indipendente con ingredienti, procedimento, foto proprie e provenienza solo descrittiva', async () => {
    await ricettaConFoto()
    const c = SchemaDettaglioPiatto.parse(await ok(copia(anna, { indicaFamiglia: true })))
    expect(c).toMatchObject({ id: 'c-ragu', nome: 'Ragù della nonna', mio: true, porzioniBase: 6, procedimento: ['Soffritto', 'Cottura lenta'], originePiattoId: null, famiglie: [{ id: 'rossi' }], famiglia: { id: 'rossi', nome: 'Famiglia Rossi' } })
    expect(c.ingredienti.map((i) => [i.nome, i.quantita, i.unita])).toEqual([['macinato', 500, 'g']])
    expect(c.provenienza).toMatchObject({ titolo: 'Ragù della nonna', copiataDa: 'Anna', famiglia: 'Famiglia' })
    expect(c.foto).toHaveLength(1)
    expect(c.foto[0]!.id).not.toBe('f-ragu')
    expect(c.foto[0]!.didascalia).toBe('Pentola')
    expect(existsSync(join(t.cartella, 'foto', `${c.foto[0]!.id}.jpg`))).toBe(true)
    // Loris non è dei Rossi: non ci copia. Senza indicarla, la Famiglia d'origine non compare.
    expect((await t.scrivi('POST', `${P}/piatti/p-ragu/copia-in-famiglia`, { id: 'c2', gruppoId: 'rossi' })).statusCode).toBe(404)
    const solo = await ok(anna.scrivi('POST', `${P}/piatti/p-ragu/copia-in-famiglia`, { id: 'c3', gruppoId: 'rossi' }))
    expect(solo.provenienza.famiglia).toBeNull()
    // Carla (solo Rossi) vede la copia, non l'originale: la provenienza non apre nulla.
    expect((await carla.leggi(`${P}/piatti/c-ragu`)).statusCode).toBe(200)
    expect((await carla.leggi(`${P}/piatti/p-ragu`)).statusCode).toBe(404)
    expect((await carla.leggi(`${P}/foto/f-ragu`)).statusCode).toBe(404)
  })

  it('non segue l\'originale: modifiche, eliminazione e uscita dalla Famiglia d\'origine; menù intatti; voti separati', async () => {
    await ricettaConFoto()
    const ev = await evento(t, 'n26', '2026-12-25')
    await ok(t.scrivi('POST', `${P}/eventi/n26/voci`, { voci: [{ id: 'v-ragu', portataId: ev.portate[1].id, nome: 'Ragù', piattoId: 'p-ragu' }] }))
    await ok(copia(anna))
    const originale = corpo(await t.leggi(`${P}/piatti/p-ragu`))
    await ok(t.scrivi('PUT', `${P}/piatti/p-ragu`, { ...originale, nome: 'Ragù cambiato', procedimento: ['Tutto diverso'] }))
    expect(corpo(await carla.leggi(`${P}/piatti/c-ragu`))).toMatchObject({ nome: 'Ragù della nonna', procedimento: ['Soffritto', 'Cottura lenta'] })
    // Il menù dell'evento resta collegato all'originale.
    expect(corpo(await t.leggi(`${P}/eventi/n26/menu`)).portate[1].voci[0].piattoId).toBe('p-ragu')
    // Anna esce dalla Famiglia d'origine: la copia resta ai Rossi.
    await ok(anna.scrivi('POST', `${P}/famiglie/${G}/esci`, {}))
    expect((await carla.leggi(`${P}/piatti/c-ragu`)).statusCode).toBe(200)
    // Originale eliminato (prima scollegato dal menù): la copia e la sua foto restano.
    await ok(t.scrivi('PUT', `${P}/voci/v-ragu`, { nome: 'Ragù', piattoId: null, porzioni: null, incaricato: '', inSpesa: true, note: '', versione: 1 }))
    await ok(t.scrivi('DELETE', `${P}/piatti/p-ragu?versione=${originale.versione + 1}`))
    const c = corpo(await carla.leggi(`${P}/piatti/c-ragu`))
    expect(c).toMatchObject({ nome: 'Ragù della nonna', provenienza: { titolo: 'Ragù della nonna' } })
    expect(existsSync(join(t.cartella, 'foto', `${c.foto[0].id}.jpg`))).toBe(true)
    expect(uno(t.db, "SELECT origine_piatto_id AS o FROM piatti WHERE id = 'c-ragu'")).toEqual({ o: null })
  })

  it('permessi: leggere l\'originale, far parte della destinazione, Famiglia diversa da quella d\'origine', async () => {
    await ricettaConFoto()
    expect((await copia(carla)).statusCode).toBe(404) // non vede l'originale
    expect((await copia(estraneo)).statusCode).toBe(404)
    expect((await copia(anna, { gruppoId: 'inesistente' })).statusCode).toBe(404)
    expect(await regola(copia(anna, { gruppoId: G }))).toBe('stessa_famiglia')
    // Una ricetta resta in una sola Famiglia.
    expect((await t.scrivi('PUT', `${P}/piatti/p-ragu/famiglie`, { gruppi: [G, 'rossi'] })).statusCode).toBe(400)
  })
})

describe('backup e migrazione 0013', () => {
  it('esportazione e ripristino conservano ricorrenze, associazioni e provenienze', async () => {
    await ok(ricorrenza(t, 'r-natale', 'Natale'))
    await evento(t, 'n26', '2026-12-25')
    await ok(associa(t, 'n26', 'r-natale'))
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-ragu', nome: 'Ragù', famiglie: [G], ingredienti: [] }))
    await ok(anna.scrivi('POST', `${P}/piatti/p-ragu/copia-in-famiglia`, { id: 'c-ragu', gruppoId: 'rossi' }))
    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    await ok(t.scrivi('DELETE', `${P}/ricorrenze/r-natale`))
    const v = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: v.token, conferma: 'RIPRISTINA' }))
    expect(corpo(await t.leggi(`${P}/eventi/n26`)).ricorrenzaId).toBe('r-natale')
    expect(corpo(await anna.leggi(`${P}/piatti/c-ragu`)).provenienza).toMatchObject({ titolo: 'Ragù', copiataDa: 'Anna' })
  })

  it('le serie diventano ricorrenze (solo nelle Famiglie); con ricette in più Famiglie si ferma senza toccare nulla', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0013-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 12 })
      const ev = (id: string, nome: string, data: string, gruppo: string | null, serie: string | null) =>
        esegui(db, "INSERT INTO eventi (id, nome, data, tipo, adulti, bambini, coefficiente_bambini, creato_il, aggiornato_il, proprietario_id, gruppo_id, serie_id) VALUES (?, ?, ?, 'pranzo', 1, 0, 0.5, 1, 1, 'utente-amministratore', ?, ?)", id, nome, data, gruppo, serie)
      ev('a', 'Natale 2025', '2025-12-25', 'gruppo-famiglia', 's1')
      ev('b', 'Natale 2026', '2026-12-25', 'gruppo-famiglia', 's1')
      ev('c', 'Pasqua', '2026-04-05', 'gruppo-famiglia', null)
      ev('d', 'Mio', '2026-01-01', null, 's2')
      ev('e', 'Mio 2', '2027-01-01', null, 's2')
      // Una ricetta condivisa con due Famiglie: la migrazione non decide da sola.
      esegui(db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Altra', 1, 1)")
      esegui(db, "INSERT INTO piatti (id, nome, nome_norm, creato_il, aggiornato_il, proprietario_id) VALUES ('p', 'P', 'p', 1, 1, 'utente-amministratore')")
      esegui(db, "INSERT INTO condivisioni_piatto_gruppo (piatto_id, gruppo_id, creato_il) VALUES ('p', 'gruppo-famiglia', 1), ('p', 'altra', 1)")
      await expect(applicaMigrazioni(db, { cartellaBackup: null })).rejects.toThrow(/UNIQUE constraint failed: condivisioni_piatto_gruppo/)
      expect(uno(db, 'SELECT max(versione) AS v FROM migrazioni_applicate')).toEqual({ v: 12 })
      expect(uno(db, 'SELECT count(*) AS n FROM condivisioni_piatto_gruppo')).toEqual({ n: 2 })
      expect(tutti(db, "SELECT name FROM sqlite_master WHERE name = 'ricorrenze'")).toEqual([])
      // Decisa la Famiglia, la migrazione passa.
      esegui(db, "DELETE FROM condivisioni_piatto_gruppo WHERE gruppo_id = 'altra'")
      await applicaMigrazioni(db, { cartellaBackup: null })
      expect(tutti(db, 'SELECT id, gruppo_id, nome FROM ricorrenze')).toEqual([{ id: 's1', gruppo_id: 'gruppo-famiglia', nome: 'Natale 2025' }])
      expect(tutti(db, 'SELECT id, ricorrenza_id FROM eventi ORDER BY id')).toEqual([
        { id: 'a', ricorrenza_id: 's1' },
        { id: 'b', ricorrenza_id: 's1' },
        { id: 'c', ricorrenza_id: null },
        { id: 'd', ricorrenza_id: null },
        { id: 'e', ricorrenza_id: null },
      ])
      expect(tutti(db, "SELECT name FROM pragma_table_info('eventi') WHERE name = 'serie_id'")).toEqual([])
      expect(uno(db, 'SELECT count(*) AS n FROM pragma_foreign_key_check')).toEqual({ n: 0 })
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})
