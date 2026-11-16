// Duplicazione degli eventi ed edizioni di una ricorrenza (SPEC §25): cosa si copia e cosa no,
// ricette senza copie inutili o non più disponibili, archivio intatto, partecipanti da
// riconfermare, serie dentro una sola Famiglia, permessi.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaEsitoDuplica } from '../../src/contratto/edizioni.ts'
import { opzioniPredefinite } from '../../src/domain/stampa.ts'
import { apriDatabase, chiudiDatabase, esegui, tutti, uno } from '../db/connessione.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // lettura
let bruno: ClientDiProva & { id: string } // modifica
let estraneo: ClientDiProva & { id: string } // altra Famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const regola = async (r: Promise<{ statusCode: number; body: string }>) => corpo(await r).errore?.dettagli?.regola
const ing = (nome: string) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `100 g ${nome}`, nome, ingredienteId: null, quantita: 100, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const duplica = (c: ClientDiProva, da: string, extra: Record<string, unknown>) => c.scrivi('POST', `${P}/eventi/${da}/duplica`, { nome: 'Natale 2027', data: '2027-12-25', ...extra })
const menu = async (id: string, c: ClientDiProva = t) => corpo(await c.leggi(`${P}/eventi/${id}/menu`))
const voci = async (id: string, c: ClientDiProva = t) => (await menu(id, c)).portate.flatMap((p: { nome: string; voci: Record<string, unknown>[] }) => p.voci.map((v) => ({ ...v, portata: p.nome })))
const conta = (tabella: string, eventoId: string) => uno<{ n: number }>(t.db, `SELECT count(*) AS n FROM ${tabella} WHERE evento_id = ?`, eventoId)!.n

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  estraneo = t.utente('Estraneo', 'utente', false)
  const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'n26', nome: 'Natale 2026', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Natale', adulti: 10, bambini: 2, coefficienteBambini: 0.5, note: 'Da nonna', gruppoId: G }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-lasagne', nome: 'Lasagne', porzioniBase: 6, ingredienti: [ing('besciamella')] }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-arrosto', nome: 'Arrosto', porzioniBase: 6, ingredienti: [ing('vitello')] }))
  await ok(t.scrivi('POST', `${P}/eventi/n26/voci`, {
    voci: [
      { id: 'v-lasagne', portataId: ev.portate[1].id, nome: 'Lasagne', piattoId: 'p-lasagne', porzioni: 14, note: 'senza funghi' },
      { id: 'v-arrosto', portataId: ev.portate[2].id, nome: 'Arrosto', piattoId: 'p-arrosto' },
      { id: 'v-pane', portataId: ev.portate[2].id, nome: 'Pane', inSpesa: false },
    ],
  }))
  await ok(t.scrivi('PUT', `${P}/eventi/n26/stampa`, { opzioni: { ...opzioniPredefinite({ occasione: 'Natale', nome: 'Natale 2026' }), modello: 'elegante', nota: 'Buon Natale' }, versione: 0 }))
  await ok(t.scrivi('POST', `${P}/eventi/n26/attivita`, { id: 'a1', titolo: 'Ragù', data: '2026-12-24', ora: '10:00', voceMenuId: 'v-lasagne', note: '' }))
  await ok(t.scrivi('PUT', `${P}/attivita/a1`, { titolo: 'Ragù', data: '2026-12-24', ora: '10:00', voceMenuId: 'v-lasagne', note: '', stato: 'fatto', versione: 1 }))
  await ok(t.scrivi('PUT', `${P}/eventi/n26/condivisioni/${anna.id}`, { permesso: 'lettura' }))
  await ok(t.scrivi('PUT', `${P}/eventi/n26/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
})
afterEach(() => t.chiudi())

describe('duplica evento', () => {
  it('evento attivo: struttura, menù, porzioni, stampa e piano da rifare; nessuno stato operativo; nessuna copia di ricette', async () => {
    // Stati operativi dell'originale: incarico con uscita dalla spesa, cosa da portare, bacheca, spesa.
    const inc = corpo(await t.leggi(`${P}/eventi/n26/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'v-arrosto')
    await ok(t.scrivi('POST', `${P}/voci/v-arrosto/assegna`, { versione: inc.versione, nome: 'Zio Marco', togliDallaSpesa: true }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/cose`, { id: 'c-vino', nome: 'Vino', prendo: true }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/messaggi`, { id: 'm1', testo: 'Chi porta il dolce?' }))
    esegui(t.db, "INSERT INTO valutazioni (evento_id, voce_id, utente_id, stelle, nome_piatto, creato_il, aggiornato_il) VALUES ('n26', 'v-lasagne', 'utente-amministratore', 5, 'Lasagne', 1, 1)")
    const piattiPrima = uno<{ n: number }>(t.db, 'SELECT count(*) AS n FROM piatti')!.n

    const esito = SchemaEsitoDuplica.parse(await ok(duplica(t, 'n26', { id: 'n27' })))
    expect(esito.avvisi).toEqual([])
    expect(esito.evento).toMatchObject({ nome: 'Natale 2027', data: '2027-12-25', oraServizio: '13:00', occasione: 'Natale', note: 'Da nonna', adulti: 10, bambini: 2, coefficienteBambini: 0.5, stato: 'attivo', copertiAutomatici: false })
    expect(esito.evento.portate.map((p) => p.nome)).toEqual((await menu('n26')).portate.map((p: { nome: string }) => p.nome))
    const copia = await voci('n27')
    expect(copia.map((v: any) => [v.portata, v.nome, v.piattoId, v.porzioni, v.note, v.incaricato, v.inSpesa])).toEqual([
      ['Primi', 'Lasagne', 'p-lasagne', 14, 'senza funghi', '', true],
      ['Secondi', 'Arrosto', 'p-arrosto', null, '', '', true], // tolta dalla spesa per l'incarico: torna
      ['Secondi', 'Pane', null, null, '', '', false], // scelta del menù: resta
    ])
    expect(uno<{ n: number }>(t.db, 'SELECT count(*) AS n FROM piatti')!.n).toBe(piattiPrima)
    expect(corpo(await t.leggi(`${P}/eventi/n27/stampa`)).opzioni).toMatchObject({ modello: 'elegante', nota: 'Buon Natale' })
    const piano = corpo(await t.leggi(`${P}/eventi/n27/attivita`))
    expect(piano).toMatchObject([{ titolo: 'Ragù', data: '2027-12-24', ora: '10:00', stato: 'da_fare', voceMenuId: copia[0].id }])
    for (const tabella of ['cose_da_portare', 'messaggi', 'valutazioni', 'notifiche', 'articoli_spesa', 'snapshot_eventi', 'partecipanti']) expect(conta(tabella, 'n27'), tabella).toBe(0)
    expect(conta('condivisioni_evento', 'n27')).toBe(0)
    // Ripetere la stessa richiesta non duplica due volte.
    expect((await ok(duplica(t, 'n26', { id: 'n27' }))).evento.id).toBe('n27')
    expect(uno<{ n: number }>(t.db, "SELECT count(*) AS n FROM eventi WHERE nome = 'Natale 2027'")!.n).toBe(1)
  })

  it('evento archiviato: dall\'archivio, che resta intatto; ricetta eliminata ricreata, ricetta altrui non leggibile esclusa', async () => {
    const e = corpo(await t.leggi(`${P}/eventi/n26`))
    await ok(t.scrivi('POST', `${P}/eventi/n26/archivia`, { versione: e.versione }))
    const prima = tutti(t.db, "SELECT * FROM snapshot_eventi WHERE evento_id = 'n26'")
    await ok(t.scrivi('DELETE', `${P}/piatti/p-arrosto?versione=1`))
    const esito = await ok(duplica(t, 'n26', { id: 'n27' }))
    expect(esito.avvisi).toEqual(['«Arrosto»: la ricetta non c\'è più, ricreata dall\'archivio come tua ricetta privata'])
    const copia = await voci('n27')
    expect(copia.map((v: any) => v.nome)).toEqual(['Lasagne', 'Arrosto', 'Pane'])
    expect(copia[0].piattoId).toBe('p-lasagne')
    const ricreata = corpo(await t.leggi(`${P}/piatti/${copia[1].piattoId}`))
    expect(ricreata).toMatchObject({ nome: 'Arrosto (Natale 2026)', mio: true, visibilita: 'privata' })
    expect(ricreata.ingredienti.map((i: { nome: string }) => i.nome)).toEqual(['vitello'])
    expect(tutti(t.db, "SELECT * FROM snapshot_eventi WHERE evento_id = 'n26'")).toEqual(prima)
    expect(corpo(await t.leggi(`${P}/eventi/n26`)).stato).toBe('archiviato')
  })

  it('evento di un altro: le ricette diventano copie del nuovo proprietario, riusate alla duplicazione successiva', async () => {
    await ok(duplica(bruno, 'n26', { id: 'b27', collegaSerie: false }))
    const a = await voci('b27', bruno)
    const copie = tutti<{ id: string }>(t.db, `SELECT id FROM piatti WHERE proprietario_id = '${bruno.id}'`)
    expect(copie).toHaveLength(2)
    expect(a.filter((v: any) => v.piattoId).every((v: any) => copie.some((c) => c.id === v.piattoId))).toBe(true)
    await ok(duplica(bruno, 'n26', { id: 'b28', nome: 'Natale 2028', collegaSerie: false }))
    expect(tutti(t.db, `SELECT id FROM piatti WHERE proprietario_id = '${bruno.id}'`)).toHaveLength(2)
    // Una ricetta resa privata ma leggibile tramite l'evento condiviso: chi duplica ne riceve una copia sua.
    await ok(t.scrivi('PUT', `${P}/piatti/p-lasagne/famiglie`, { gruppi: [] }))
    const esito = await ok(duplica(anna, 'n26', { id: 'a27', collegaSerie: false }))
    expect(esito.avvisi).toEqual([])
    const lasagne = (await voci('a27', anna))[0]
    expect(uno(t.db, 'SELECT proprietario_id AS p FROM piatti WHERE id = ?', lasagne.piattoId)).toEqual({ p: anna.id })
  })

  it('partecipanti facoltativi: stessa composizione, tutto da riconfermare; coperti manuali', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-marco', nome: 'Zio Marco' }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/partecipanti`, { id: 'p1', esternoId: 'e-marco', stato: 'confermato' }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/partecipanti`, { id: 'a1x', invitoId: 'p1', nome: 'Zia Lia', stato: 'confermato' }))
    await ok(t.scrivi('PUT', `${P}/partecipanti/p1/accompagnatori`, { anonimi: { adultiConfermati: 1, adultiInAttesa: 1, bambiniConfermati: 2, bambiniInAttesa: 0 }, versione: 1 }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/partecipanti`, { id: 'p2', utenteId: anna.id, stato: 'assente' }))
    const e = corpo(await t.leggi(`${P}/eventi/n26`))
    await ok(t.scrivi('PUT', `${P}/eventi/n26/coperti`, { automatici: true, adulti: 10, bambini: 2, maxAccompagnatori: 3, versione: e.versione }))
    expect((await ok(duplica(t, 'n26', { id: 'senza' }))).evento).toMatchObject({ copertiAutomatici: false })
    expect(conta('partecipanti', 'senza')).toBe(0)
    const esito = await ok(duplica(t, 'n26', { id: 'con', nome: 'Natale 2028', copiaPartecipanti: true }))
    // Coperti della copia: quelli effettivi dell'originale, scritti a mano (3 adulti, 2 bambini).
    expect(esito.evento).toMatchObject({ copertiAutomatici: false, adulti: 3, bambini: 2, maxAccompagnatori: 3 })
    const l = corpo(await t.leggi(`${P}/eventi/con/partecipanti`))
    expect(l.inviti.map((i: any) => [i.nome, i.stato, i.esternoId, i.utenteId, i.anonimi, i.accompagnatori.map((a: any) => [a.nome, a.stato])])).toEqual([
      ['Zio Marco', 'in_attesa', 'e-marco', null, { adultiConfermati: 0, adultiInAttesa: 2, bambiniConfermati: 0, bambiniInAttesa: 2 }, [['Zia Lia', 'in_attesa']]],
      ['Anna', 'in_attesa', null, anna.id, { adultiConfermati: 0, adultiInAttesa: 0, bambiniConfermati: 0, bambiniInAttesa: 0 }, []],
    ])
    // Essere fra i partecipanti della copia non dà accesso: Anna non la vede.
    expect((await anna.leggi(`${P}/eventi/con`)).statusCode).toBe(404)
  })
})

describe('edizioni di una ricorrenza', () => {
  it('la copia si collega alla serie; collegare e scollegare a mano; mai fra Famiglie diverse; permessi', async () => {
    const esito = await ok(duplica(t, 'n26', { id: 'n27' }))
    const serie = esito.evento.serieId
    expect(serie).toEqual(expect.any(String))
    expect(corpo(await t.leggi(`${P}/eventi/n26`)).serieId).toBe(serie)
    expect(corpo(await t.leggi(`${P}/eventi/n27/edizioni`))).toMatchObject({ serieId: serie, edizioni: [{ id: 'n26', nome: 'Natale 2026' }], puoCollegare: true })
    // Un evento creato a parte si collega a mano, e si scollega.
    await ok(t.scrivi('POST', `${P}/eventi`, { id: 'n25', nome: 'Natale 2025', data: '2025-12-25', oraServizio: null, tipo: 'pranzo', occasione: 'Natale', adulti: 9, bambini: 0, note: '', gruppoId: G }))
    expect(corpo(await t.leggi(`${P}/eventi/n25/edizioni`)).altriEventi.map((x: { id: string }) => x.id)).toEqual(['n27', 'n26'])
    await ok(t.scrivi('PUT', `${P}/eventi/n25/serie`, { conEventoId: 'n27' }))
    expect(corpo(await t.leggi(`${P}/eventi/n27/edizioni`)).edizioni.map((x: { id: string }) => x.id)).toEqual(['n25', 'n26'])
    await ok(t.scrivi('PUT', `${P}/eventi/n25/serie`, { conEventoId: null }))
    expect(corpo(await t.leggi(`${P}/eventi/n25`)).serieId).toBeNull()
    // Famiglie diverse: né duplicando né a mano; il database lo impedisce comunque.
    esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Altra', 1, 1)")
    esegui(t.db, "INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('altra', 'utente-amministratore', 'membro', 1)")
    expect(await regola(duplica(t, 'n26', { id: 'x1', gruppoId: 'altra' }))).toBe('serie_altra_famiglia')
    const altrove = await ok(duplica(t, 'n26', { id: 'x2', gruppoId: 'altra', collegaSerie: false }))
    expect(altrove.evento.serieId).toBeNull()
    expect(await regola(t.scrivi('PUT', `${P}/eventi/x2/serie`, { conEventoId: 'n26' }))).toBe('serie_altra_famiglia')
    expect(() => esegui(t.db, `UPDATE eventi SET serie_id = '${serie}' WHERE id = 'x2'`)).toThrow(/Famiglie diverse/)
    // Spostare un evento in un'altra Famiglia lo toglie dalla serie.
    await ok(t.scrivi('PUT', `${P}/eventi/n27/famiglia`, { gruppoId: 'altra' }))
    expect(corpo(await t.leggi(`${P}/eventi/n27`)).serieId).toBeNull()
    // Famiglia di cui non si fa parte; chi legge non collega; chi non vede: 404.
    expect((await duplica(t, 'n26', { id: 'x3', gruppoId: 'inesistente', collegaSerie: false })).statusCode).toBe(404)
    expect((await anna.scrivi('PUT', `${P}/eventi/n26/serie`, { conEventoId: null })).statusCode).toBe(403)
    expect(await regola(duplica(anna, 'n25', { id: 'x4' }))).toBe(undefined) // n25 non condiviso con Anna
    expect((await duplica(anna, 'n25', { id: 'x4' })).statusCode).toBe(404)
    expect((await duplica(estraneo, 'n26', { id: 'x5' })).statusCode).toBe(404)
    expect((await estraneo.leggi(`${P}/eventi/n26/edizioni`)).statusCode).toBe(404)
  })

  it('le edizioni elencate sono solo quelle visibili', async () => {
    await ok(duplica(t, 'n26', { id: 'n27' }))
    // Anna vede n26 ma non n27: dalla sua parte la serie non mostra n27.
    expect(corpo(await anna.leggi(`${P}/eventi/n26/edizioni`))).toMatchObject({ edizioni: [], puoCollegare: false })
  })
})

describe('migrazioni 0011 e 0012', () => {
  it('eventi esistenti senza serie, nessun collegamento dedotto dai nomi; voci senza origine', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0011-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 10 })
      for (const [id, nome, data] of [['a', 'Natale 2025', '2025-12-25'], ['b', 'Natale 2026', '2026-12-25']]) {
        esegui(db, "INSERT INTO eventi (id, nome, data, tipo, adulti, bambini, coefficiente_bambini, creato_il, aggiornato_il, proprietario_id, gruppo_id) VALUES (?, ?, ?, 'pranzo', 1, 0, 0.5, 1, 1, 'utente-amministratore', 'gruppo-famiglia')", id, nome, data)
      }
      await applicaMigrazioni(db, { cartellaBackup: null })
      expect(tutti(db, 'SELECT id, serie_id FROM eventi ORDER BY id')).toEqual([{ id: 'a', serie_id: null }, { id: 'b', serie_id: null }])
      expect(tutti(db, "SELECT name FROM pragma_table_info('voci_menu') WHERE name = 'voce_origine_id'")).toHaveLength(1)
      expect(uno(db, 'SELECT count(*) AS n FROM pragma_foreign_key_check')).toEqual({ n: 0 })
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})
