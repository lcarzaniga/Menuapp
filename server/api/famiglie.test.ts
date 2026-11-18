// Più Famiglie per persona (SPEC §21): appartenenza, inviti ad aderire, isolamento, ricette
// condivise con Famiglie precise, eventi della Famiglia, classifiche separate, migrazione 0008.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, tutti, uno } from '../db/connessione.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
let bruno: ClientDiProva & { id: string }
let solo: ClientDiProva & { id: string } // nessuna Famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const token = (link: string) => link.split('/#/unisciti/')[1]!
const evento = (c: ClientDiProva, id: string, gruppoId?: string | null) =>
  c.scrivi('POST', `${P}/eventi`, { id, nome: `Evento ${id}`, data: '2026-01-10', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 4, bambini: 0, note: '', ...(gruppoId === undefined ? {} : { gruppoId }) })

/** Anna crea la Famiglia «Rossi» e vi fa entrare Bruno con un invito. */
async function famigliaRossi() {
  const f = await ok(anna.scrivi('POST', `${P}/famiglie`, { id: 'rossi', nome: 'Famiglia Rossi' }))
  const inv = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
  await ok(bruno.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(inv.link) }))
  return f
}

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno', 'utente', false)
  solo = t.utente('Solo', 'utente', false)
})
afterEach(() => t.chiudi())

describe('appartenenza e inviti', () => {
  it('senza Famiglie: elenco vuoto; si crea una Famiglia e se ne diventa amministratore', async () => {
    expect(corpo(await solo.leggi(`${P}/gruppi`))).toEqual([])
    expect(corpo(await solo.leggi(`${P}/persone`))).toEqual([])
    const f = await ok(solo.scrivi('POST', `${P}/famiglie`, { id: 'mia', nome: 'La mia famiglia' }))
    expect(f).toMatchObject({ nome: 'La mia famiglia', ruolo: 'amministratore', membri: [{ nome: 'Solo', ruolo: 'amministratore' }] })
    // Ripetizione con lo stesso id: idempotente; un id di altri: no.
    await ok(solo.scrivi('POST', `${P}/famiglie`, { id: 'mia', nome: 'La mia famiglia' }))
    expect((await anna.scrivi('POST', `${P}/famiglie`, { id: 'mia', nome: 'Rubata' })).statusCode).toBe(422)
    // Anche senza Famiglia i contenuti personali restano: ricette ed eventi propri.
    await ok(solo.scrivi('POST', `${P}/piatti`, { id: 'p-solo', nome: 'Mia ricetta', ingredienti: [] }))
    expect((await ok(evento(bruno, 'ev-personale'))).id).toBe('ev-personale')
  })

  it('invito ad aderire: distinto da quello dell\'account, monouso, anteprima, scadenza, annullamento', async () => {
    await ok(anna.scrivi('POST', `${P}/famiglie`, { id: 'rossi', nome: 'Famiglia Rossi' }))
    // Solo l'amministratore della Famiglia invita.
    expect((await t.scrivi('POST', `${P}/famiglie/rossi/inviti`, {})).statusCode).toBe(404)
    const inv = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
    expect(inv.link).toMatch(/\/#\/unisciti\/[A-Za-z0-9_-]{43}$/)
    expect(inv.scadeIl - inv.creatoIl).toBe(7 * 24 * 3600_000)
    expect(corpo(await bruno.scrivi('POST', `${P}/inviti-famiglia/anteprima`, { token: token(inv.link) }))).toEqual({ famiglia: { id: 'rossi', nome: 'Famiglia Rossi' }, invitatoDa: 'Anna', stato: 'valido' })
    // Senza sessione non si vede nulla (l'invito alla Famiglia non crea account).
    expect((await t.anonimo.scrivi('POST', `${P}/inviti-famiglia/anteprima`, { token: token(inv.link) })).statusCode).toBe(401)
    const f = await ok(bruno.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(inv.link) }))
    expect(f.membri.map((m: { nome: string; ruolo: string }) => [m.nome, m.ruolo])).toEqual([
      ['Anna', 'amministratore'],
      ['Bruno', 'membro'],
    ])
    expect(corpo(await solo.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(inv.link) })).errore.dettagli.regola).toBe('invito_usato')
    expect(corpo(await bruno.scrivi('POST', `${P}/inviti-famiglia/anteprima`, { token: token(inv.link) })).stato).toBe('gia_membro')
    const scaduto = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
    esegui(t.db, 'UPDATE inviti_famiglia SET scade_il = 1 WHERE usato_il IS NULL')
    expect(corpo(await solo.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(scaduto.link) })).errore.dettagli.regola).toBe('invito_scaduto')
    const annullato = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
    await ok(anna.scrivi('DELETE', `${P}/famiglie/rossi/inviti/${annullato.id}`))
    expect(corpo(await solo.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(annullato.link) })).errore.dettagli.regola).toBe('invito_annullato')
    expect((await solo.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: 'x'.repeat(43) })).statusCode).toBe(404)
  })

  it('uscita, rimozione e passaggio dell\'amministrazione: resta sempre un amministratore', async () => {
    await famigliaRossi()
    expect(corpo(await anna.scrivi('POST', `${P}/famiglie/rossi/esci`, {})).errore.dettagli.regola).toBe('ultimo_amministratore')
    expect((await bruno.scrivi('DELETE', `${P}/famiglie/rossi/membri/${anna.id}`)).statusCode).toBe(403)
    expect((await bruno.scrivi('POST', `${P}/famiglie/rossi/amministrazione`, { utenteId: bruno.id })).statusCode).toBe(403)
    const f = await ok(anna.scrivi('POST', `${P}/famiglie/rossi/amministrazione`, { utenteId: bruno.id }))
    expect(f.ruolo).toBe('membro')
    await ok(anna.scrivi('POST', `${P}/famiglie/rossi/esci`, {}))
    expect(corpo(await anna.leggi(`${P}/gruppi`)).map((g: { id: string }) => g.id)).toEqual([G])
    expect(corpo(await bruno.scrivi('POST', `${P}/famiglie/rossi/esci`, {})).errore.dettagli.regola).toBe('unico_membro')
    // Rimozione da parte dell'amministratore.
    const inv = await ok(bruno.scrivi('POST', `${P}/famiglie/rossi/inviti`, {}))
    await ok(solo.scrivi('POST', `${P}/inviti-famiglia/accetta`, { token: token(inv.link) }))
    await ok(bruno.scrivi('DELETE', `${P}/famiglie/rossi/membri/${solo.id}`))
    expect((await solo.leggi(`${P}/gruppi/rossi/bacheca`)).statusCode).toBe(404)
  })
})

describe('isolamento fra Famiglie', () => {
  it('bacheche separate per chi è in una sola delle due; chi è in entrambe le vede tutte e due', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/gruppi/rossi/messaggi`, { id: 'm-rossi', testo: 'Solo per i Rossi' }))
    await ok(t.scrivi('POST', `${P}/gruppi/${G}/messaggi`, { id: 'm-fam', testo: 'Per la Famiglia' }))
    expect(corpo(await anna.leggi(`${P}/gruppi`)).map((g: { id: string }) => g.id).sort()).toEqual([G, 'rossi'])
    expect((await t.leggi(`${P}/gruppi/rossi/bacheca`)).statusCode).toBe(404)
    expect((await t.leggi(`${P}/messaggi/m-rossi`)).statusCode).toBe(404)
    expect((await bruno.leggi(`${P}/messaggi/m-fam`)).statusCode).toBe(404)
    expect(corpo(await anna.leggi(`${P}/gruppi/rossi/bacheca`)).messaggi).toHaveLength(1)
    // Notifiche con la Famiglia di provenienza.
    const n = corpo(await anna.leggi(`${P}/notifiche`))
    expect(n.map((x: { famiglia: string; testo: string }) => [x.famiglia, x.testo])).toEqual([['Famiglia', 'Per la Famiglia']])
    // Persone: per Famiglia.
    expect(corpo(await anna.leggi(`${P}/persone?gruppo=rossi`))).toEqual([{ id: bruno.id, nome: 'Bruno' }])
    expect((await t.leggi(`${P}/persone?gruppo=rossi`)).statusCode).toBe(404)
  })

  it('ricette: privata o visibile in una sola Famiglia (mai in più d\'una); chi esce smette di condividerle', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-priv', nome: 'Privata', ingredienti: [], famiglie: [] }))
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-rossi', nome: 'Solo Rossi', ingredienti: [], famiglie: ['rossi'] }))
    // In più Famiglie no: per un'altra Famiglia si copia (SPEC §28).
    expect(corpo(await anna.scrivi('POST', `${P}/piatti`, { id: 'p-due', nome: 'Per tutti', ingredienti: [], famiglie: [G, 'rossi'] })).errore.dettagli.regola).toBe('una_famiglia')
    const due = await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-due', nome: 'Per tutti', ingredienti: [], famiglie: [G] }))
    expect(due.famiglie.map((f: { nome: string }) => f.nome)).toEqual(['Famiglia'])
    expect((await anna.scrivi('PUT', `${P}/piatti/p-due/famiglie`, { gruppi: [G, 'rossi'] })).statusCode).toBe(400)
    expect((await anna.scrivi('POST', `${P}/piatti`, { id: 'p-x', nome: 'x', ingredienti: [], famiglie: ['inesistente'] })).statusCode).toBe(404)
    const vede = async (c: ClientDiProva) => corpo(await c.leggi(`${P}/piatti`)).filter((p: { mio: boolean }) => !p.mio).map((p: { id: string }) => p.id).sort()
    expect(await vede(t)).toEqual(['p-due'])
    expect(await vede(bruno)).toEqual(['p-rossi'])
    expect((await t.leggi(`${P}/piatti/p-rossi`)).statusCode).toBe(404)
    // L'amministratore della Famiglia non vede le ricette private dei membri.
    expect((await anna.leggi(`${P}/piatti/p-priv`)).statusCode).toBe(200)
    expect((await bruno.leggi(`${P}/piatti/p-priv`)).statusCode).toBe(404)
    // Cambio delle Famiglie della ricetta; poi Anna esce dai Rossi (dopo aver passato l'amministrazione).
    await ok(anna.scrivi('PUT', `${P}/piatti/p-due/famiglie`, { gruppi: ['rossi'] }))
    expect(await vede(t)).toEqual([])
    await ok(anna.scrivi('POST', `${P}/famiglie/rossi/amministrazione`, { utenteId: bruno.id }))
    await ok(anna.scrivi('POST', `${P}/famiglie/rossi/esci`, {}))
    expect(await vede(bruno)).toEqual([])
    expect((await bruno.scrivi('PUT', `${P}/piatti/p-due/famiglie`, { gruppi: [] })).statusCode).toBe(404)
  })

  it('eventi: nella Famiglia scelta (verificata), invitabili solo i suoi membri, elenco per Famiglia attiva', async () => {
    await famigliaRossi()
    expect((await evento(t, 'ev-x', 'rossi')).statusCode).toBe(404)
    const ev = await ok(evento(anna, 'ev-rossi', 'rossi'))
    await ok(evento(anna, 'ev-fam', G))
    expect(corpo(await anna.leggi(`${P}/eventi/ev-rossi/accesso`)).gruppo).toEqual({ id: 'rossi', nome: 'Famiglia Rossi' })
    // Loris non è dei Rossi: non si invita (nemmeno conoscendone l'id); Bruno sì.
    expect((await anna.scrivi('PUT', `${P}/eventi/ev-rossi/condivisioni/utente-amministratore`, { permesso: 'lettura' })).statusCode).toBe(404)
    await ok(anna.scrivi('PUT', `${P}/eventi/ev-rossi/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
    expect((await anna.scrivi('POST', `${P}/eventi/ev-rossi/trasferisci`, { utenteId: 'utente-amministratore', versione: ev.versione })).statusCode).toBe(404)
    // Essere della Famiglia non dà accesso agli eventi: servono gli inviti.
    expect((await bruno.leggi(`${P}/eventi/ev-fam`)).statusCode).toBe(404)
    expect((await t.leggi(`${P}/eventi/ev-fam`)).statusCode).toBe(404)
    const elenco = async (g: string) => corpo(await anna.leggi(`${P}/eventi?gruppo=${g}`)).map((e: { id: string }) => e.id).sort()
    expect(await elenco('rossi')).toEqual(['ev-rossi'])
    expect(await elenco(G)).toEqual(['ev-fam'])
    expect((await t.leggi(`${P}/eventi?gruppo=rossi`)).statusCode).toBe(404)
    // Senza scelta: l'unica Famiglia, o nessuna con più Famiglie o nessuna Famiglia.
    expect(corpo(await t.leggi(`${P}/eventi/${(await ok(evento(t, 'ev-loris'))).id}/accesso`)).gruppo).toEqual({ id: G, nome: 'Famiglia' })
    expect(corpo(await anna.leggi(`${P}/eventi/${(await ok(evento(anna, 'ev-anna'))).id}/accesso`)).gruppo).toBeNull()
    // Spostamento in un'altra Famiglia del proprietario.
    await ok(anna.scrivi('PUT', `${P}/eventi/ev-anna/famiglia`, { gruppoId: 'rossi' }))
    expect(await elenco('rossi')).toEqual(['ev-anna', 'ev-rossi'])
    expect((await anna.scrivi('PUT', `${P}/eventi/ev-anna/famiglia`, { gruppoId: 'inesistente' })).statusCode).toBe(404)
  })

  it('classifiche separate per Famiglia', async () => {
    await famigliaRossi()
    for (const [id, g] of [
      ['ev-rossi', 'rossi'],
      ['ev-fam', G],
    ] as const) {
      const ev = await ok(evento(anna, id, g))
      await ok(anna.scrivi('POST', `${P}/eventi/${id}/voci`, { voci: [{ id: `v-${id}`, portataId: ev.portate[1].id, nome: g === 'rossi' ? 'Lasagne Rossi' : 'Lasagne Famiglia' }] }))
      await ok(anna.scrivi('PUT', `${P}/voci/v-${id}/valutazione`, { stelle: 5 }))
    }
    expect(corpo(await anna.leggi(`${P}/classifica?gruppo=rossi`)).map((x: { nome: string }) => x.nome)).toEqual(['Lasagne Rossi'])
    expect(corpo(await anna.leggi(`${P}/classifica?gruppo=${G}`)).map((x: { nome: string }) => x.nome)).toEqual(['Lasagne Famiglia'])
    expect((await t.leggi(`${P}/classifica?gruppo=rossi`)).statusCode).toBe(404)
  })

  it('rimossi dalla Famiglia attiva: bacheca, notifiche e ricette di quella Famiglia spariscono', async () => {
    await famigliaRossi()
    await ok(anna.scrivi('POST', `${P}/piatti`, { id: 'p-rossi', nome: 'Solo Rossi', ingredienti: [], famiglie: ['rossi'] }))
    await ok(anna.scrivi('POST', `${P}/gruppi/rossi/messaggi`, { id: 'm1', testo: 'Ciao Rossi' }))
    expect(corpo(await bruno.leggi(`${P}/notifiche`))).toHaveLength(1)
    await ok(anna.scrivi('DELETE', `${P}/famiglie/rossi/membri/${bruno.id}`))
    expect(corpo(await bruno.leggi(`${P}/gruppi`))).toEqual([])
    expect(corpo(await bruno.leggi(`${P}/notifiche`))).toEqual([])
    expect((await bruno.leggi(`${P}/piatti/p-rossi`)).statusCode).toBe(404)
    expect((await bruno.leggi(`${P}/gruppi/rossi/bacheca`)).statusCode).toBe(404)
  })
})

describe('migrazione 0008', () => {
  it('eventi alla Famiglia del proprietario se unica; ricette «di famiglia» condivise esattamente dove erano visibili', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0008-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 7 })
      const T = 1
      esegui(db, "INSERT INTO utenti (id, nome, nome_norm, ruolo, creato_il, aggiornato_il) VALUES ('u-due', 'Due', 'due', 'utente', 1, 1), ('u-zero', 'Zero', 'zero', 'utente', 1, 1)")
      esegui(db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Altra', 1, 1)")
      esegui(db, "INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('altra', 'u-due', 'membro', 1), ('gruppo-famiglia', 'u-due', 'membro', 1)")
      for (const [id, owner] of [
        ['e-admin', 'utente-amministratore'],
        ['e-due', 'u-due'],
        ['e-zero', 'u-zero'],
      ]) {
        esegui(db, `INSERT INTO eventi (id, nome, data, tipo, adulti, bambini, coefficiente_bambini, creato_il, aggiornato_il, proprietario_id) VALUES (?, 'E', '2026-01-01', 'pranzo', 1, 0, 0.5, ?, ?, ?)`, id, T, T, owner)
      }
      for (const [id, owner, vis] of [
        ['p-fam', 'u-due', 'famiglia'],
        ['p-priv', 'u-due', 'privata'],
        ['p-zero', 'u-zero', 'famiglia'],
      ]) {
        esegui(db, `INSERT INTO piatti (id, nome, nome_norm, creato_il, aggiornato_il, proprietario_id, visibilita) VALUES (?, 'P', 'p', 1, 1, ?, ?)`, id, owner, vis)
      }
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 8 })
      expect(tutti(db, 'SELECT id, gruppo_id FROM eventi ORDER BY id')).toEqual([
        { id: 'e-admin', gruppo_id: 'gruppo-famiglia' },
        { id: 'e-due', gruppo_id: null },
        { id: 'e-zero', gruppo_id: null },
      ])
      expect(tutti(db, 'SELECT piatto_id, gruppo_id FROM condivisioni_piatto_gruppo ORDER BY piatto_id, gruppo_id')).toEqual([
        { piatto_id: 'p-fam', gruppo_id: 'altra' },
        { piatto_id: 'p-fam', gruppo_id: 'gruppo-famiglia' },
      ])
      expect(uno(db, 'SELECT count(*) AS n FROM pragma_foreign_key_check')).toEqual({ n: 0 })
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})
