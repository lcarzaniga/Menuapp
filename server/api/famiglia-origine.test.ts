// Famiglia d'origine delle ricette (SPEC §35, piano di evoluzione fase 1A): migrazione 0016 senza
// scelte arbitrarie né cambi di visibilità, origine alla nascita (creazione, copie, eventi,
// archivio), origine fissa, indicazione da parte del proprietario, controllo dalla console.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, tutti, uno } from '../db/connessione.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { riepilogoOrigini } from '../servizi/ricettario.ts'
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
const token = (link: string) => link.split('/#/unisciti/')[1]!
const piatto = (c: ClientDiProva, id: string) => ok(c.leggi(`${P}/piatti/${id}`))
const origine = (id: string) => uno<{ famiglia_origine_id: string | null; famiglia_origine_nome: string | null }>(t.db, 'SELECT famiglia_origine_id, famiglia_origine_nome FROM piatti WHERE id = ?', id)

/** Anna (già nella Famiglia di prova) crea anche «Famiglia Rossi» e vi fa entrare Bruno. */
async function famigliaRossi() {
  await ok(anna.scrivi('POST', `${P}/famiglie`, { id: 'rossi', nome: 'Famiglia Rossi' }))
  const inv = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
  await ok(bruno.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(inv.link) }))
}

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno', 'utente', false)
})
afterEach(() => t.chiudi())

describe('migrazione 0016', () => {
  it('condivisa → quella Famiglia; una sola Famiglia → quella; altrimenti da indicare; visibilità invariata', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0016-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 15 })
      const utente = (id: string) =>
        esegui(db, "INSERT INTO utenti (id, nome, nome_norm, ruolo, stato, creato_il, aggiornato_il) VALUES (?, ?, ?, 'utente', 'attivo', 1, 1)", id, id, id)
      const famiglia = (id: string, nome: string) => esegui(db, 'INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES (?, ?, 1, 1)', id, nome)
      const membro = (g: string, u: string) => esegui(db, "INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES (?, ?, 'membro', 1)", g, u)
      const ricetta = (id: string, proprietario: string, condivisaCon?: string) => {
        esegui(db, "INSERT INTO piatti (id, nome, nome_norm, proprietario_id, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, 1, 1)", id, id, id, proprietario)
        if (condivisaCon) esegui(db, 'INSERT INTO condivisioni_piatto_gruppo (piatto_id, gruppo_id, creato_il) VALUES (?, ?, 1)', id, condivisaCon)
      }
      famiglia('a', 'Famiglia A')
      famiglia('b', 'Famiglia B')
      utente('una') // solo in A
      utente('due') // in A e in B
      utente('nessuna')
      membro('a', 'una')
      membro('a', 'due')
      membro('b', 'due')
      ricetta('condivisa-b', 'due', 'b')
      ricetta('privata-una', 'una')
      ricetta('condivisa-a', 'una', 'a')
      ricetta('privata-due', 'due')
      ricetta('privata-nessuna', 'nessuna')
      const condivisioni = tutti(db, 'SELECT * FROM condivisioni_piatto_gruppo ORDER BY piatto_id')
      await applicaMigrazioni(db, { cartellaBackup: null })
      expect(tutti(db, 'SELECT id, famiglia_origine_id AS g, famiglia_origine_nome AS nome FROM piatti ORDER BY id')).toEqual([
        { id: 'condivisa-a', g: 'a', nome: 'Famiglia A' },
        { id: 'condivisa-b', g: 'b', nome: 'Famiglia B' },
        { id: 'privata-due', g: null, nome: null },
        { id: 'privata-nessuna', g: null, nome: null },
        { id: 'privata-una', g: 'a', nome: 'Famiglia A' },
      ])
      // Condivisioni e visibilità non cambiano.
      expect(tutti(db, 'SELECT * FROM condivisioni_piatto_gruppo ORDER BY piatto_id')).toEqual(condivisioni)
      expect(tutti(db, 'PRAGMA foreign_key_check')).toEqual([])
      expect(riepilogoOrigini(db)[0]).toBe("Ricette: 5; con la Famiglia d'origine: 3; da indicare: 2.")
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})

describe('origine alla nascita', () => {
  it('dalla Famiglia attiva (anche privata), mai da una Famiglia di cui non si fa parte', async () => {
    await famigliaRossi()
    // Anna ha due Famiglie: condivisa con Rossi → Rossi.
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p1', nome: 'Ragù', famiglie: ['rossi'] }))
    expect((await piatto(anna, 'p1')).famigliaOrigine).toEqual({ id: 'rossi', nome: 'Famiglia Rossi' })
    // Privata con la Famiglia attiva indicata.
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p2', nome: 'Pesto', visibilita: 'privata', famigliaOrigine: G }))
    expect((await piatto(anna, 'p2'))).toMatchObject({ famigliaOrigine: { id: G, nome: 'Famiglia' }, famiglie: [] })
    // Privata senza indicazione con due Famiglie: da indicare.
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p3', nome: 'Torta', visibilita: 'privata' }))
    expect((await piatto(anna, 'p3')).famigliaOrigine).toBeNull()
    // Bruno non è nella Famiglia di prova.
    expect((await bruno.scrivi('POST', `${P}/piatti`, { id: 'p4', nome: 'Furbo', famigliaOrigine: G })).statusCode).toBe(404)
    // Bruno ha una sola Famiglia (Rossi): ci nasce anche senza indicarla.
    await ok(bruno.scrivi('POST', `${P}/piatti`, { id: 'p5', nome: 'Polenta', visibilita: 'privata' }))
    expect(origine('p5')).toEqual({ famiglia_origine_id: 'rossi', famiglia_origine_nome: 'Famiglia Rossi' })
  })

  it('copie: in un\'altra Famiglia nella destinazione, nel proprio ricettario nella Famiglia dell\'originale', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-ragu', nome: 'Ragù', famiglie: [G] }))
    await ok(anna.scrivi('POST', `${P}/piatti/p-ragu/copia-in-famiglia`, { id: 'c-rossi', gruppoId: 'rossi', indicaFamiglia: true }))
    expect(origine('c-rossi')).toEqual({ famiglia_origine_id: 'rossi', famiglia_origine_nome: 'Famiglia Rossi' })
    await ok(t.scrivi('POST', `${P}/piatti/p-ragu/copia`, { id: 'c-mia' }))
    expect(origine('c-mia')).toEqual({ famiglia_origine_id: G, famiglia_origine_nome: 'Famiglia' })
  })

  it('ricetta creata da una voce di menù: nella Famiglia dell\'evento', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2030-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 4, bambini: 0, note: '', gruppoId: 'rossi' }))
    const portata = corpo(await anna.leggi(`${P}/eventi/ev`)).portate[0].id
    await ok(anna.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: portata, nome: 'Lasagne' }] }))
    await ok(anna.scrivi('POST', `${P}/voci/v1/crea-piatto`, { piattoId: 'p-lasagne', versione: 1 }))
    expect(origine('p-lasagne')).toEqual({ famiglia_origine_id: 'rossi', famiglia_origine_nome: 'Famiglia Rossi' })
  })
})

describe('origine fissa e indicazione', () => {
  it('il proprietario indica una sua Famiglia una volta sola; poi non cambia, neanche nel database', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p', nome: 'Torta', visibilita: 'privata' }))
    const v = (await piatto(anna, 'p')).versione
    // Solo il proprietario, solo una sua Famiglia, con la versione attuale.
    expect((await bruno.scrivi('PUT', `${P}/piatti/p/famiglia-origine`, { gruppoId: 'rossi', versione: v })).statusCode).toBe(404)
    expect((await anna.scrivi('PUT', `${P}/piatti/p/famiglia-origine`, { gruppoId: 'inesistente', versione: v })).statusCode).toBe(404)
    expect((await anna.scrivi('PUT', `${P}/piatti/p/famiglia-origine`, { gruppoId: 'rossi', versione: v + 5 })).statusCode).toBe(409)
    const p = await ok(anna.scrivi('PUT', `${P}/piatti/p/famiglia-origine`, { gruppoId: 'rossi', versione: v }))
    expect(p).toMatchObject({ famigliaOrigine: { id: 'rossi', nome: 'Famiglia Rossi' }, famiglie: [], versione: v + 1 })
    expect((await anna.scrivi('PUT', `${P}/piatti/p/famiglia-origine`, { gruppoId: G, versione: p.versione })).statusCode).toBe(422)
    expect(() => esegui(t.db, "UPDATE piatti SET famiglia_origine_id = ? WHERE id = 'p'", G)).toThrow(/non modificabile/)
    expect(() => esegui(t.db, "UPDATE piatti SET famiglia_origine_nome = 'Altro' WHERE id = 'p'")).toThrow(/non modificabile/)
  })

  it('Famiglia rinominata: si mostra il nome attuale; eliminata: resta il nome della nascita', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p', nome: 'Ragù', famiglie: ['rossi'] }))
    esegui(t.db, "UPDATE gruppi SET nome = 'Rossi e Bianchi' WHERE id = 'rossi'")
    expect((await piatto(anna, 'p')).famigliaOrigine).toEqual({ id: 'rossi', nome: 'Rossi e Bianchi' })
    esegui(t.db, "DELETE FROM gruppi WHERE id = 'rossi'")
    expect((await piatto(anna, 'p')).famigliaOrigine).toEqual({ id: null, nome: 'Famiglia Rossi' })
    expect(corpo(await anna.leggi(`${P}/piatti`)).find((x: { id: string }) => x.id === 'p').famigliaOrigine).toEqual({ id: null, nome: 'Famiglia Rossi' })
  })

  it('esportazione e ripristino conservano l\'origine', async () => {
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p', nome: 'Ragù' }))
    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    const v = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: v.token, conferma: 'RIPRISTINA' }))
    expect(origine('p')).toEqual({ famiglia_origine_id: G, famiglia_origine_nome: 'Famiglia' })
  })
})
