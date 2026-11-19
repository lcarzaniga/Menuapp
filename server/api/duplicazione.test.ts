// Duplicazione degli eventi ed edizioni di una ricorrenza (SPEC §25): cosa si copia e cosa no,
// ricette senza copie inutili o non più disponibili, archivio intatto, partecipanti da
// riconfermare, permessi (ricorrenze: ricorrenze.test.ts).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaEsitoDuplica } from '../../src/contratto/edizioni.ts'
import { opzioniPredefinite } from '../../src/domain/stampa.ts'
import { esegui, tutti, uno } from '../db/connessione.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // lettura
let bruno: ClientDiProva & { id: string } // modifica
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const ing = (nome: string) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `100 g ${nome}`, nome, ingredienteId: null, quantita: 100, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const duplica = (c: ClientDiProva, da: string, extra: Record<string, unknown>) => c.scrivi('POST', `${P}/eventi/${da}/duplica`, { nome: 'Natale 2027', data: '2027-12-25', ...extra })
const menu = async (id: string, c: ClientDiProva = t) => corpo(await c.leggi(`${P}/eventi/${id}/menu`))
const voci = async (id: string, c: ClientDiProva = t) => (await menu(id, c)).portate.flatMap((p: { nome: string; voci: Record<string, unknown>[] }) => p.voci.map((v) => ({ ...v, portata: p.nome })))
const conta = (tabella: string, eventoId: string) => uno<{ n: number }>(t.db, `SELECT count(*) AS n FROM ${tabella} WHERE evento_id = ?`, eventoId)!.n

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
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
    await ok(duplica(bruno, 'n26', { id: 'b27' }))
    const a = await voci('b27', bruno)
    const copie = tutti<{ id: string }>(t.db, `SELECT id FROM piatti WHERE proprietario_id = '${bruno.id}'`)
    expect(copie).toHaveLength(2)
    expect(a.filter((v: any) => v.piattoId).every((v: any) => copie.some((c) => c.id === v.piattoId))).toBe(true)
    await ok(duplica(bruno, 'n26', { id: 'b28', nome: 'Natale 2028' }))
    expect(tutti(t.db, `SELECT id FROM piatti WHERE proprietario_id = '${bruno.id}'`)).toHaveLength(2)
    // Una ricetta resa privata ma leggibile tramite l'evento condiviso: chi duplica ne riceve una copia sua.
    await ok(t.scrivi('PUT', `${P}/piatti/p-lasagne/famiglie`, { gruppi: [] }))
    const esito = await ok(duplica(anna, 'n26', { id: 'a27' }))
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

describe('scelte, chi porta cosa e anteprima (SPEC §25, piano di evoluzione fase 2)', () => {
  async function conIncarichi() {
    // Ospite della rubrica per il vino, Bruno (con l'app) per l'arrosto, un nome scritto a mano per il pane.
    const arrosto = corpo(await t.leggi(`${P}/eventi/n26/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'v-arrosto')
    await ok(t.scrivi('POST', `${P}/voci/v-arrosto/assegna`, { versione: arrosto.versione, utenteId: bruno.id, togliDallaSpesa: true }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/cose`, { id: 'c-vino', nome: 'Vino', quantita: '6 bottiglie' }))
    const vino = corpo(await t.leggi(`${P}/eventi/n26/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'c-vino')
    await ok(t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: vino.versione, nome: 'Zia Rosa', salvaInRubrica: true }))
    await ok(t.scrivi('POST', `${P}/voci/v-arrosto/completa`, { versione: arrosto.versione + 1, completato: true }))
    await ok(t.scrivi('POST', `${P}/eventi/n26/cose`, { id: 'c-ghiaccio', nome: 'Ghiaccio' }))
  }

  it('anteprima: cosa verrà creato con le scelte, senza scrivere nulla', async () => {
    await conIncarichi()
    const revisione = uno<{ valore: string }>(t.db, "SELECT valore FROM meta WHERE chiave = 'revisione'")
    const eventi = uno<{ n: number }>(t.db, 'SELECT count(*) AS n FROM eventi')!.n
    const { anteprima } = await ok(duplica(t, 'n26', { id: 'n27', anteprima: true, copia: { incarichi: true, partecipanti: false } }))
    expect(anteprima.portate.flatMap((p: { voci: unknown[] }) => p.voci)).toEqual([
      { nome: 'Lasagne', ricetta: 'collegata' },
      { nome: 'Arrosto', ricetta: 'collegata' },
      { nome: 'Pane', ricetta: 'nessuna' },
    ])
    expect(anteprima.attivita).toEqual([{ titolo: 'Ragù', data: '2027-12-24', ora: '10:00' }])
    expect(anteprima.incarichi).toEqual([
      { nome: 'Arrosto', precedente: 'Bruno' },
      { nome: 'Vino', precedente: 'Zia Rosa' },
      { nome: 'Ghiaccio', precedente: null },
    ])
    expect(anteprima).toMatchObject({ stampa: true, partecipanti: 0, incarichiDisponibili: true, avvisi: [] })
    // Nulla è cambiato.
    expect(uno<{ n: number }>(t.db, 'SELECT count(*) AS n FROM eventi')!.n).toBe(eventi)
    expect(uno<{ valore: string }>(t.db, "SELECT valore FROM meta WHERE chiave = 'revisione'")).toEqual(revisione)
    // Le scelte cambiano l'anteprima: senza menù solo le portate, senza piano e stampa niente.
    const senza = (await ok(duplica(t, 'n26', { id: 'n27', anteprima: true, copia: { menu: false, piano: false, stampa: false } }))).anteprima
    expect(senza.portate.every((p: { voci: unknown[] }) => p.voci.length === 0)).toBe(true)
    expect(senza).toMatchObject({ attivita: [], stampa: false, incarichi: [] })
  })

  it('chi porta cosa: tutto da assegnare con chi se ne occupava; niente accettato o fatto; la spesa torna', async () => {
    await conIncarichi()
    await ok(duplica(t, 'n26', { id: 'n27', copia: { incarichi: true } }))
    const inc = corpo(await t.leggi(`${P}/eventi/n27/incarichi`)).incarichi as { nome: string; stato: string; incaricato: string; precedente: unknown; inSpesa: boolean | null }[]
    const per = (nome: string) => inc.find((i) => i.nome === nome)!
    // Bruno non vede ancora il nuovo evento (le condivisioni non si copiano): per ora solo il nome.
    expect(per('Arrosto')).toMatchObject({ stato: 'da_assegnare', incaricato: '', precedente: { nome: 'Bruno', utenteId: null, esternoId: null }, inSpesa: true })
    expect(per('Vino')).toMatchObject({ stato: 'da_assegnare', incaricato: '', precedente: { nome: 'Zia Rosa', utenteId: null, esternoId: expect.any(String) } })
    expect(per('Ghiaccio')).toMatchObject({ stato: 'da_assegnare', precedente: null })
    // Condiviso con Bruno, il promemoria lo riconosce; riaffidare con un tocco, il promemoria sparisce.
    await ok(t.scrivi('PUT', `${P}/eventi/n27/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
    const arrosto = corpo(await t.leggi(`${P}/eventi/n27/incarichi`)).incarichi.find((i: { nome: string }) => i.nome === 'Arrosto')
    expect(arrosto.precedente).toEqual({ nome: 'Bruno', utenteId: bruno.id, esternoId: null })
    await ok(t.scrivi('POST', `${P}/voci/${arrosto.id}/assegna`, { versione: arrosto.versione, utenteId: bruno.id }))
    expect(corpo(await t.leggi(`${P}/eventi/n27/incarichi`)).incarichi.find((i: { nome: string }) => i.nome === 'Arrosto')).toMatchObject({ stato: 'assegnato', incaricato: 'Bruno', precedente: null })
    // L'originale non cambia.
    expect(corpo(await t.leggi(`${P}/eventi/n26/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'v-arrosto')).toMatchObject({ stato: 'completato' })
  })

  it('in un\'altra Famiglia gli id non validi restano solo nome; senza menù solo le portate; senza piano né stampa', async () => {
    await conIncarichi()
    await ok(t.scrivi('POST', `${P}/famiglie`, { id: 'mia', nome: 'Solo mia' }))
    await ok(duplica(t, 'n26', { id: 'n27', gruppoId: 'mia', copia: { incarichi: true } }))
    const inc = corpo(await t.leggi(`${P}/eventi/n27/incarichi`)).incarichi as { nome: string; precedente: unknown }[]
    expect(inc.find((i) => i.nome === 'Arrosto')?.precedente).toEqual({ nome: 'Bruno', utenteId: null, esternoId: null })
    expect(inc.find((i) => i.nome === 'Vino')?.precedente).toEqual({ nome: 'Zia Rosa', utenteId: null, esternoId: null })

    await ok(duplica(t, 'n26', { id: 'n28', copia: { menu: false, piano: false, stampa: false } }))
    expect(await voci('n28')).toEqual([])
    expect((await menu('n28')).portate.map((p: { nome: string }) => p.nome)).toEqual((await menu('n26')).portate.map((p: { nome: string }) => p.nome))
    expect([conta('attivita', 'n28'), conta('stili_stampa', 'n28'), conta('cose_da_portare', 'n28')]).toEqual([0, 0, 0])
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
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 12 })
      expect(tutti(db, 'SELECT id, serie_id FROM eventi ORDER BY id')).toEqual([{ id: 'a', serie_id: null }, { id: 'b', serie_id: null }])
      expect(tutti(db, "SELECT name FROM pragma_table_info('voci_menu') WHERE name = 'voce_origine_id'")).toHaveLength(1)
      expect(uno(db, 'SELECT count(*) AS n FROM pragma_foreign_key_check')).toEqual({ n: 0 })
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})
