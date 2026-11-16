// Partecipanti, conferme e accompagnatori (SPEC §24): elenco facoltativo, coperti manuali e
// calcolati, +N con e senza nome, conferme parziali, niente doppi conteggi, permessi del
// proprio invito, isolamento fra Famiglie, incarichi, archivio ed esportazione.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaPartecipanti } from '../../src/contratto/partecipanti.ts'
import { apriDatabase, chiudiDatabase, esegui, tutti, uno } from '../db/connessione.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { leggiEvento } from '../db/repo/eventi.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // invitata all'evento in lettura, partecipante con l'app
let bruno: ClientDiProva & { id: string } // collaboratore (modifica)
let carla: ClientDiProva & { id: string } // della Famiglia, senza accesso all'evento
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
const elenco = async (c: ClientDiProva = t) => SchemaPartecipanti.parse(corpo(await c.leggi(`${P}/eventi/ev/partecipanti`)))
const evento = async () => corpo(await t.leggi(`${P}/eventi/ev`))
const ing = (nome: string, quantita: number) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `${quantita} g ${nome}`, nome, ingredienteId: null, quantita, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const spesa = async () => corpo(await t.leggi(`${P}/eventi/ev/spesa`)).voci as { nome: string; quantita: number }[]
const nuovo = (id: string, extra: Record<string, unknown>) => t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id, ...extra })
const coperti = async (automatici: boolean, extra: Record<string, unknown> = {}) => {
  const e = await evento()
  return ok(t.scrivi('PUT', `${P}/eventi/ev/coperti`, { automatici, adulti: e.copertiManuali.adulti, bambini: e.copertiManuali.bambini, maxAccompagnatori: e.maxAccompagnatori, versione: e.versione, ...extra }))
}
const leggiP = async (id: string) => (await elenco()).inviti.flatMap((i) => [i, ...i.accompagnatori]).find((p) => p.id === id)!

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  carla = t.utente('Carla')
  estraneo = t.utente('Estraneo', 'utente', false)
  const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Natale', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 8, bambini: 2, coefficienteBambini: 0.5, note: '', gruppoId: G }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-tiramisu', nome: 'Tiramisù', porzioniBase: 10, ingredienti: [ing('mascarpone', 1000)] }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-pane', nome: 'Pane', porzioniBase: 10, ingredienti: [ing('farina', 1000)] }))
  await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, {
    voci: [
      { id: 'v-tiramisu', portataId: ev.portate[3].id, nome: 'Tiramisù', piattoId: 'p-tiramisu' },
      // Porzioni personalizzate: restano tali anche con i coperti automatici.
      { id: 'v-pane', portataId: ev.portate[3].id, nome: 'Pane', piattoId: 'p-pane', porzioni: 20 },
    ],
  }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
})
afterEach(() => t.chiudi())

describe('elenco facoltativo e coperti', () => {
  it('senza elenco l\'evento funziona come prima; aggiungere invitati in manuale non cambia i coperti', async () => {
    const vuoto = await elenco()
    expect(vuoto).toMatchObject({ inviti: [], copertiAutomatici: false, copertiManuali: { adulti: 8, bambini: 2 }, copertiCalcolati: { adulti: 0, bambini: 0 } })
    const prima = JSON.stringify(await spesa())
    await ok(nuovo('p-marco', { nome: 'Zio Marco', stato: 'confermato' }))
    await ok(nuovo('p-pina', { nome: 'Zia Pina', categoria: 'adulto' }))
    expect(await evento()).toMatchObject({ adulti: 8, bambini: 2, copertiAutomatici: false })
    expect(JSON.stringify(await spesa())).toBe(prima)
    expect(corpo(await t.leggi(`${P}/eventi/ev/menu`)).copertiEquivalenti).toBe(9)
  })

  it('coperti dai confermati (accompagnatori compresi, in attesa e assenti esclusi), coefficiente, porzioni personalizzate, spesa', async () => {
    await ok(nuovo('p-marco', { nome: 'Zio Marco', stato: 'confermato' }))
    await ok(nuovo('p-anna2', { nome: 'Zia Anna', stato: 'confermato' }))
    const anna2 = await leggiP('p-anna2')
    // Zia Anna: +1 adulto confermato.
    await ok(t.scrivi('PUT', `${P}/partecipanti/p-anna2/accompagnatori`, { anonimi: { adultiConfermati: 1, adultiInAttesa: 0, bambiniConfermati: 0, bambiniInAttesa: 0 }, versione: anna2.versione }))
    // Paolo: due adulti e tre bambini in più, confermati.
    await ok(nuovo('p-paolo', { nome: 'Paolo', stato: 'confermato' }))
    await ok(t.scrivi('PUT', `${P}/partecipanti/p-paolo/accompagnatori`, { anonimi: { adultiConfermati: 2, adultiInAttesa: 0, bambiniConfermati: 3, bambiniInAttesa: 0 }, versione: 1 }))
    await ok(nuovo('p-gino', { nome: 'Gino', stato: 'in_attesa' }))
    await ok(nuovo('p-lia', { nome: 'Lia', stato: 'assente' }))
    await coperti(true)
    // Adulti: Marco, Anna, +1, Paolo, +2 = 6; bambini 3 → 6 + 3 × 0,5 = 7,5.
    const e = await evento()
    expect(e).toMatchObject({ adulti: 6, bambini: 3, copertiAutomatici: true, copertiManuali: { adulti: 8, bambini: 2 } })
    const menu = corpo(await t.leggi(`${P}/eventi/ev/menu`))
    expect(menu.copertiEquivalenti).toBe(7.5)
    const voci = menu.portate.flatMap((p: { voci: unknown[] }) => p.voci) as { id: string; porzioniEffettive: number }[]
    expect(voci.find((v) => v.id === 'v-tiramisu')!.porzioniEffettive).toBe(7.5)
    expect(voci.find((v) => v.id === 'v-pane')!.porzioniEffettive).toBe(20)
    expect((await spesa()).find((v) => v.nome === 'mascarpone')!.quantita).toBe(750)
    expect((await spesa()).find((v) => v.nome === 'farina')!.quantita).toBe(2000)
    // Gino conferma: si ricalcola tutto.
    await ok(t.scrivi('PUT', `${P}/partecipanti/p-gino`, { nome: 'Gino', categoria: 'adulto', stato: 'confermato', note: '', versione: 1 }))
    expect((await spesa()).find((v) => v.nome === 'mascarpone')!.quantita).toBe(850)
    const c = (await elenco()).conteggio
    expect(c).toEqual({ adulti: { confermati: 7, inAttesa: 0, assenti: 1 }, bambini: { confermati: 3, inAttesa: 0, assenti: 0 }, inviti: 5, persone: 11 })
  })

  it('cambio di modalità: nessuna perdita; tornando al manuale si possono copiare i calcolati', async () => {
    await ok(nuovo('p-marco', { nome: 'Zio Marco', stato: 'confermato' }))
    await coperti(true)
    expect(await evento()).toMatchObject({ adulti: 1, bambini: 0 })
    // Una modifica dell'evento in automatico non tocca i numeri manuali.
    const e = await evento()
    await ok(t.scrivi('PUT', `${P}/eventi/ev`, { ...e, nome: 'Natale in famiglia', portate: e.portate.map((p: { id: string; nome: string }) => ({ id: p.id, nome: p.nome })) }))
    expect((await evento()).copertiManuali).toEqual({ adulti: 8, bambini: 2 })
    await coperti(false)
    expect(await evento()).toMatchObject({ adulti: 8, bambini: 2, copertiAutomatici: false })
    await coperti(true)
    await coperti(false, { adulti: 1, bambini: 0 })
    expect(await evento()).toMatchObject({ adulti: 1, bambini: 0, copertiAutomatici: false })
    expect((await elenco()).inviti.map((i) => i.nome)).toEqual(['Zio Marco'])
    // Solo chi organizza cambia la modalità.
    const x = await evento()
    expect((await anna.scrivi('PUT', `${P}/eventi/ev/coperti`, { automatici: true, adulti: 1, bambini: 0, maxAccompagnatori: null, versione: x.versione })).statusCode).toBe(403)
  })
})

describe('accompagnatori', () => {
  it('nominativi e anonimi, conferme parziali, titolare che rinuncia, stati indipendenti, autonomia senza doppi conteggi', async () => {
    await coperti(true)
    await ok(nuovo('p-paolo', { nome: 'Paolo', stato: 'confermato' }))
    await ok(nuovo('a-giulia', { invitoId: 'p-paolo', nome: 'Giulia', stato: 'confermato' }))
    await ok(nuovo('a-leo', { invitoId: 'p-paolo', nome: 'Leo', categoria: 'bambino', stato: 'in_attesa' }))
    await ok(t.scrivi('PUT', `${P}/partecipanti/p-paolo/accompagnatori`, { anonimi: { adultiConfermati: 0, adultiInAttesa: 1, bambiniConfermati: 1, bambiniInAttesa: 0 }, versione: 1 }))
    let l = await elenco()
    expect(l.inviti[0]!.accompagnatori.map((a) => [a.nome, a.categoria, a.stato])).toEqual([['Giulia', 'adulto', 'confermato'], ['Leo', 'bambino', 'in_attesa']])
    expect(l.copertiCalcolati).toEqual({ adulti: 2, bambini: 1 })
    // Paolo non viene: Giulia resta confermata (stato suo).
    await ok(t.scrivi('PUT', `${P}/partecipanti/p-paolo`, { nome: 'Paolo', categoria: 'adulto', stato: 'assente', note: '', versione: 2 }))
    expect((await elenco()).copertiCalcolati).toEqual({ adulti: 1, bambini: 1 })
    // Giulia diventa un invito a sé: conta sempre una volta sola.
    const prima = (await elenco()).conteggio
    await ok(t.scrivi('POST', `${P}/partecipanti/a-giulia/autonomo`, { versione: 1 }))
    l = await elenco()
    expect(l.inviti.map((i) => i.nome)).toEqual(['Paolo', 'Giulia'])
    expect(l.conteggio.adulti).toEqual(prima.adulti)
    expect(l.conteggio.persone).toBe(prima.persone)
    // Lo stesso nome non si aggiunge due volte (né come accompagnatore né come invito).
    expect(await regola(nuovo('x', { nome: 'giulia' }))).toBe('gia_partecipante')
    expect(await regola(nuovo('y', { invitoId: 'p-paolo', nome: 'Giulia' }))).toBe('gia_partecipante')
    // Un accompagnatore non ha accompagnatori e non fa da invito.
    expect((await nuovo('z', { invitoId: 'a-leo', nome: 'Zeno' })).statusCode).toBe(404)
    expect(() => esegui(t.db, "UPDATE partecipanti SET anonimi_adulti_confermati = 1 WHERE id = 'a-leo'")).toThrow()
    // Togliere un invito toglie i suoi accompagnatori nominativi.
    await ok(t.scrivi('DELETE', `${P}/partecipanti/p-paolo?versione=${(await leggiP('p-paolo')).versione}`))
    expect((await elenco()).inviti.map((i) => i.nome)).toEqual(['Giulia'])
    expect(uno(t.db, "SELECT count(*) AS n FROM partecipanti WHERE id = 'a-leo'")).toEqual({ n: 0 })
  })

  it('una persona con l\'app conferma per sé e gestisce i suoi accompagnatori, entro il limite; non tocca gli altri', async () => {
    await ok(nuovo('p-anna', { utenteId: anna.id }))
    await ok(nuovo('p-marco', { nome: 'Zio Marco' }))
    let l = await elenco(anna)
    expect(l).toMatchObject({ mioInvitoId: 'p-anna', puoGestire: false, scelte: { persone: [], rubrica: [] } })
    await ok(anna.scrivi('PUT', `${P}/partecipanti/p-anna`, { nome: 'Anna', categoria: 'adulto', stato: 'confermato', note: 'arrivo alle 12', versione: 1 }))
    await ok(anna.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'a-luca', invitoId: 'p-anna', nome: 'Luca', categoria: 'bambino', stato: 'confermato' }))
    await ok(anna.scrivi('PUT', `${P}/partecipanti/p-anna/accompagnatori`, { anonimi: { adultiConfermati: 1, adultiInAttesa: 0, bambiniConfermati: 0, bambiniInAttesa: 0 }, versione: 2 }))
    l = await elenco(anna)
    expect(l.inviti[0]).toMatchObject({ nome: 'Anna', stato: 'confermato', note: 'arrivo alle 12', accompagnatori: [{ nome: 'Luca', stato: 'confermato' }] })
    // Non cambia gli altri inviti, non ne crea di nuovi, non cambia la propria categoria.
    expect((await anna.scrivi('PUT', `${P}/partecipanti/p-marco`, { nome: 'Zio Marco', categoria: 'adulto', stato: 'confermato', note: '', versione: 1 })).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'p-x', nome: 'Amica di Anna' })).statusCode).toBe(403)
    expect((await anna.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'a-y', invitoId: 'p-marco', nome: 'Y' })).statusCode).toBe(403)
    expect((await anna.scrivi('PUT', `${P}/partecipanti/p-anna`, { nome: 'Anna', categoria: 'bambino', stato: 'confermato', note: '', versione: 3 })).statusCode).toBe(403)
    // Limite dell'evento: 2 accompagnatori (Luca + 1 senza nome) → il terzo no; chi organizza sì.
    await coperti(false, { maxAccompagnatori: 2 })
    expect(await regola(anna.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'a-z', invitoId: 'p-anna', nome: 'Zoe' }))).toBe('troppi_accompagnatori')
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'a-z', invitoId: 'p-anna', nome: 'Zoe' }))
    // Ridurre si può sempre; l'accompagnatore proprio si toglie.
    await ok(anna.scrivi('PUT', `${P}/partecipanti/p-anna/accompagnatori`, { anonimi: { adultiConfermati: 0, adultiInAttesa: 0, bambiniConfermati: 0, bambiniInAttesa: 0 }, versione: (await leggiP('p-anna')).versione }))
    await ok(anna.scrivi('DELETE', `${P}/partecipanti/a-luca?versione=1`))
    // Chi è collegato ma non vede l'evento non vede né il suo invito né l'elenco.
    await ok(nuovo('p-carla', { utenteId: carla.id }))
    expect((await carla.leggi(`${P}/eventi/ev/partecipanti`)).statusCode).toBe(404)
    expect((await carla.scrivi('PUT', `${P}/partecipanti/p-carla`, { nome: 'Carla', categoria: 'adulto', stato: 'confermato', note: '', versione: 1 })).statusCode).toBe(404)
    // L'elenco non dà accesso: nessuna condivisione creata per Carla.
    expect(uno(t.db, `SELECT count(*) AS n FROM condivisioni_evento WHERE utente_id = '${carla.id}'`)).toEqual({ n: 0 })
    // E l'accesso non è partecipazione: Bruno vede l'evento ma non è nell'elenco.
    expect((await elenco(bruno)).inviti.map((i) => i.nome)).not.toContain('Bruno')
  })

  it('niente doppioni con chi usa l\'app e con la rubrica; collaboratore autorizzato; isolamento fra Famiglie', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-maria', nome: 'Nonna Maria' }))
    expect(await ok(nuovo('p1', { nome: 'nonna maria' }))).toMatchObject({ nome: 'Nonna Maria', esternoId: 'e-maria' })
    expect(await ok(nuovo('p2', { nome: 'CARLA' }))).toMatchObject({ nome: 'Carla', utenteId: carla.id })
    expect(await regola(nuovo('p3', { utenteId: carla.id }))).toBe('gia_partecipante')
    expect(await regola(nuovo('p4', { esternoId: 'e-maria' }))).toBe('gia_partecipante')
    expect(await ok(nuovo('p5', { nome: 'Zio Marco', salvaInRubrica: true }))).toMatchObject({ esternoId: expect.any(String) })
    // Rinominare in rubrica segue nei partecipanti; togliere dalla rubrica lascia il nome.
    await ok(t.scrivi('PUT', `${P}/rubrica/e-maria`, { nome: 'Nonna Maria Rossi', note: '', versione: 1 }))
    expect((await leggiP('p1')).nome).toBe('Nonna Maria Rossi')
    await ok(t.scrivi('DELETE', `${P}/rubrica/e-maria`))
    expect(await leggiP('p1')).toMatchObject({ nome: 'Nonna Maria Rossi', esternoId: null })
    // Il collaboratore in modifica registra le conferme di chi non ha l'app.
    await ok(bruno.scrivi('PUT', `${P}/partecipanti/p1`, { nome: 'Nonna Maria Rossi', categoria: 'adulto', stato: 'confermato', note: '', versione: (await leggiP('p1')).versione }))
    // Altre Famiglie: persone e rubrica estranee non si collegano; l'evento non si vede.
    esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Altra', 1, 1)")
    esegui(t.db, `INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('altra', '${estraneo.id}', 'amministratore', 1)`)
    await ok(estraneo.scrivi('POST', `${P}/famiglie/altra/rubrica`, { id: 'e-altro', nome: 'Zio di altri' }))
    expect((await nuovo('q1', { esternoId: 'e-altro' })).statusCode).toBe(404)
    expect((await nuovo('q2', { utenteId: estraneo.id })).statusCode).toBe(404)
    expect((await estraneo.leggi(`${P}/eventi/ev/partecipanti`)).statusCode).toBe(404)
    expect((await estraneo.scrivi('PUT', `${P}/partecipanti/p1`, { nome: 'x', categoria: 'adulto', stato: 'assente', note: '', versione: 9 })).statusCode).toBe(404)
    // Chi legge soltanto non aggiunge partecipanti.
    expect((await anna.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'q3', nome: 'Qualcuno' })).statusCode).toBe(403)
  })
})

describe('incarichi, archivio ed esportazione', () => {
  it('un partecipante come responsabile; se non viene un avviso, l\'incarico resta', async () => {
    await ok(nuovo('p-marco', { nome: 'Zio Marco', salvaInRubrica: true, stato: 'confermato' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-vino', nome: 'Vino', quantitaNumero: 4, unita: 'bottiglie' }))
    const inc = corpo(await t.leggi(`${P}/eventi/ev/incarichi`))
    expect(inc.partecipanti).toEqual([{ id: 'p-marco', nome: 'Zio Marco', assente: false }])
    const vino = inc.incarichi.find((i: { id: string }) => i.id === 'c-vino')
    const a = await ok(t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: vino.versione, partecipanteId: 'p-marco' }))
    expect(a).toMatchObject({ incaricato: 'Zio Marco', incaricatoEsternoId: expect.any(String), quantitaNumero: 4, unita: 'bottiglie', responsabileAssente: false })
    expect((await leggiP('p-marco')).incarichi).toEqual(['Vino'])
    await ok(t.scrivi('PUT', `${P}/partecipanti/p-marco`, { nome: 'Zio Marco', categoria: 'adulto', stato: 'assente', note: '', versione: (await leggiP('p-marco')).versione }))
    const dopo = corpo(await t.leggi(`${P}/eventi/ev/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'c-vino')
    expect(dopo).toMatchObject({ incaricato: 'Zio Marco', stato: 'assegnato', responsabileAssente: true, quantitaNumero: 4 })
    // Un partecipante con l'app senza accesso all'evento: affidato per nome.
    await ok(nuovo('p-carla', { utenteId: carla.id }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-pane', nome: 'Pane' }))
    const pane = await ok(t.scrivi('POST', `${P}/cose/c-pane/assegna`, { versione: 1, partecipanteId: 'p-carla' }))
    expect(pane).toMatchObject({ incaricato: 'Carla', incaricatoId: null })
  })

  it('archiviato: elenco, stati e modalità conservati; leggibile dopo i cambi di rubrica; riapertura; esportazione e ripristino', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-maria', nome: 'Nonna Maria' }))
    await ok(nuovo('p1', { esternoId: 'e-maria', stato: 'confermato' }))
    await ok(nuovo('a1', { invitoId: 'p1', nome: 'Nonno Pino', stato: 'confermato' }))
    await ok(t.scrivi('PUT', `${P}/partecipanti/p1/accompagnatori`, { anonimi: { adultiConfermati: 0, adultiInAttesa: 0, bambiniConfermati: 2, bambiniInAttesa: 1 }, versione: 1 }))
    await coperti(true)
    let e = await evento()
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: e.versione }))
    const s = uno<{ contenuto: string }>(t.db, "SELECT contenuto FROM snapshot_eventi WHERE evento_id = 'ev' AND stato = 'valido'")!
    const contenuto = JSON.parse(s.contenuto)
    expect(contenuto.evento).toMatchObject({ copertiAutomatici: true, adulti: 2, bambini: 2 })
    expect(contenuto.partecipanti[0]).toMatchObject({ nome: 'Nonna Maria', anonimi: { bambiniConfermati: 2, bambiniInAttesa: 1 }, accompagnatori: [{ nome: 'Nonno Pino', stato: 'confermato' }] })
    // Archiviato: nessuna modifica, e il nome resta anche togliendo la persona dalla rubrica.
    expect((await t.scrivi('PUT', `${P}/partecipanti/p1`, { nome: 'Nonna Maria', categoria: 'adulto', stato: 'assente', note: '', versione: 2 })).statusCode).toBe(422)
    await ok(t.scrivi('DELETE', `${P}/rubrica/e-maria`))
    const archiviato = await elenco()
    expect(archiviato).toMatchObject({ solaLettura: true, puoGestire: false, copertiCalcolati: { adulti: 2, bambini: 2 } })
    expect(archiviato.inviti[0]).toMatchObject({ nome: 'Nonna Maria', esternoId: 'e-maria' })
    // Riapertura: l'elenco vivo torna modificabile.
    e = await evento()
    await ok(t.scrivi('POST', `${P}/eventi/ev/riapri`, { versione: e.versione }))
    expect((await elenco()).inviti[0]).toMatchObject({ nome: 'Nonna Maria', esternoId: null })
    // Esportazione e ripristino: titolari prima degli accompagnatori.
    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    expect(esportazione.dati.partecipanti.map((r: { id: string }) => r.id)).toEqual(['p1', 'a1'])
    await ok(t.scrivi('DELETE', `${P}/partecipanti/p1?versione=${(await leggiP('p1')).versione}`))
    const v = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: v.token, conferma: 'RIPRISTINA' }))
    const ripristinato = await elenco()
    expect(ripristinato.inviti[0]).toMatchObject({ nome: 'Nonna Maria', anonimi: { bambiniConfermati: 2 }, accompagnatori: [{ nome: 'Nonno Pino' }] })
    expect(ripristinato.copertiAutomatici).toBe(true)
  })
})

describe('migrazione 0010', () => {
  it('eventi esistenti in manuale, nessun partecipante creato dai numeri, incarichi e archivi intatti', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0010-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 9 })
      esegui(db, "INSERT INTO eventi (id, nome, data, tipo, adulti, bambini, coefficiente_bambini, creato_il, aggiornato_il, proprietario_id) VALUES ('e1', 'Pasqua', '2026-04-05', 'pranzo', 12, 3, 0.5, 1, 1, 'utente-amministratore')")
      esegui(db, "INSERT INTO cose_da_portare (id, evento_id, nome, incaricato, quantita_numero, unita, creato_il, aggiornato_il) VALUES ('c1', 'e1', 'Vino', 'Zio Marco', 4, 'bottiglie', 1, 1)")
      esegui(db, "INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il, superato_il) VALUES ('s1', 'e1', 'superato', 1, '{\"x\":1}', 1, 2)")
      const prima = JSON.stringify([tutti(db, 'SELECT * FROM cose_da_portare'), tutti(db, 'SELECT * FROM snapshot_eventi')])
      await applicaMigrazioni(db, { cartellaBackup: null })
      expect(leggiEvento(db, 'e1')).toMatchObject({ adulti: 12, bambini: 3, copertiAutomatici: false, copertiManuali: { adulti: 12, bambini: 3 }, maxAccompagnatori: null })
      expect(uno(db, 'SELECT count(*) AS n FROM partecipanti')).toEqual({ n: 0 })
      expect(JSON.stringify([tutti(db, 'SELECT * FROM cose_da_portare'), tutti(db, 'SELECT * FROM snapshot_eventi')])).toBe(prima)
      expect(uno(db, 'SELECT count(*) AS n FROM pragma_foreign_key_check')).toEqual({ n: 0 })
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })
})
