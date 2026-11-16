// Persone senza account e incarichi (SPEC §22): rubrica per Famiglia, responsabili esterni o
// nomi liberi, niente doppioni con chi usa l'app, quantità e note, spesa, isolamento.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { esegui, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // invitata in lettura
let bruno: ClientDiProva & { id: string } // collaboratore (modifica)
let estraneo: ClientDiProva & { id: string } // altra Famiglia
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const ingrediente = (nome: string) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `100 g ${nome}`, nome, ingredienteId: null, quantita: 100, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const incarico = async (c: ClientDiProva, id: string) => corpo(await c.leggi(`${P}/eventi/ev/incarichi`)).incarichi.find((x: { id: string }) => x.id === id)
const spesa = async () => JSON.stringify(corpo(await t.leggi(`${P}/eventi/ev/spesa`)))

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  bruno = t.utente('Bruno')
  estraneo = t.utente('Estraneo', 'utente', false)
  const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Pranzo', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 10, bambini: 0, note: '', gruppoId: G }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-lasagne', nome: 'Lasagne', porzioniBase: 6, ingredienti: [ingrediente('besciamella')] }))
  await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v-lasagne', portataId: ev.portate[1].id, nome: 'Lasagne', piattoId: 'p-lasagne', porzioni: 10 }] }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${bruno.id}`, { permesso: 'modifica' }))
})
afterEach(() => t.chiudi())

describe('rubrica delle persone senza account', () => {
  it('la gestiscono i membri della Famiglia; niente doppioni con la rubrica o con chi usa l\'app; altre Famiglie non la vedono', async () => {
    const marco = await ok(anna.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-marco', nome: 'Zio Marco', note: 'Porta sempre il vino' }))
    expect(marco).toMatchObject({ nome: 'Zio Marco', note: 'Porta sempre il vino' })
    expect(corpo(await anna.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-2', nome: 'zio marco' })).errore.dettagli.regola).toBe('nome_in_rubrica')
    expect(corpo(await anna.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-3', nome: 'Bruno' })).errore.dettagli.regola).toBe('nome_di_un_membro')
    expect(corpo(await bruno.leggi(`${P}/famiglie/${G}/rubrica`)).map((e: { nome: string }) => e.nome)).toEqual(['Zio Marco'])
    expect((await estraneo.leggi(`${P}/famiglie/${G}/rubrica`)).statusCode).toBe(404)
    expect((await estraneo.scrivi('PUT', `${P}/rubrica/e-marco`, { nome: 'x', note: '', versione: 1 })).statusCode).toBe(404)
    expect((await estraneo.scrivi('DELETE', `${P}/rubrica/e-marco`)).statusCode).toBe(404)
    // Nessuna identità digitale: non è un utente e non compare fra le persone con l'app.
    expect(uno(t.db, "SELECT count(*) AS n FROM utenti WHERE nome = 'Zio Marco'")).toEqual({ n: 0 })
    expect(corpo(await t.leggi(`${P}/persone`)).map((p: { nome: string }) => p.nome)).not.toContain('Zio Marco')
  })

  it('rinominare segue negli incarichi; togliere dalla rubrica lascia il nome in «A cura di»', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-maria', nome: 'Nonna Maria' }))
    const v = await incarico(t, 'v-lasagne')
    await ok(t.scrivi('POST', `${P}/voci/v-lasagne/assegna`, { versione: v.versione, esternoId: 'e-maria' }))
    const e = corpo(await t.leggi(`${P}/famiglie/${G}/rubrica`))[0]
    await ok(t.scrivi('PUT', `${P}/rubrica/e-maria`, { nome: 'Nonna Maria Rossi', note: '', versione: e.versione }))
    expect(corpo(await t.leggi(`${P}/voci/v-lasagne`)).incaricato).toBe('Nonna Maria Rossi')
    await ok(t.scrivi('DELETE', `${P}/rubrica/e-maria`))
    expect(await incarico(t, 'v-lasagne')).toMatchObject({ incaricato: 'Nonna Maria Rossi', incaricatoEsternoId: null, stato: 'assegnato' })
  })
})

describe('incarichi affidati a chi non ha l\'app', () => {
  it('dalla rubrica: «A cura di», nota, uscita e rientro nella spesa, stato gestito da chi organizza', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-anna2', nome: 'Zia Anna' }))
    expect(await spesa()).toContain('besciamella')
    const v = await incarico(t, 'v-lasagne')
    expect(v.porzioni).toBe(10)
    const a = await ok(bruno.scrivi('POST', `${P}/voci/v-lasagne/assegna`, { versione: v.versione, esternoId: 'e-anna2', togliDallaSpesa: true, note: 'per 10 persone, senza glutine' }))
    expect(a).toMatchObject({ incaricato: 'Zia Anna', incaricatoEsternoId: 'e-anna2', incaricatoId: null, stato: 'assegnato', inSpesa: false, note: 'per 10 persone, senza glutine' })
    // Stesso modello del menù: la voce dice «A cura di Zia Anna» ed esce dalla spesa.
    expect(corpo(await t.leggi(`${P}/voci/v-lasagne`))).toMatchObject({ incaricato: 'Zia Anna', inSpesa: false })
    expect(await spesa()).not.toContain('besciamella')
    // La persona senza app non può segnarlo: lo fa chi organizza.
    const fatto = await ok(t.scrivi('POST', `${P}/voci/v-lasagne/completa`, { versione: a.versione, completato: true }))
    expect(fatto.stato).toBe('completato')
    expect((await anna.scrivi('POST', `${P}/voci/v-lasagne/completa`, { versione: fatto.versione, completato: false })).statusCode).toBe(403)
    // Liberato: torna nella spesa, la nota resta.
    const libero = await ok(t.scrivi('POST', `${P}/voci/v-lasagne/rinuncia`, { versione: fatto.versione }))
    expect(libero).toMatchObject({ incaricato: '', incaricatoEsternoId: null, stato: 'da_assegnare', inSpesa: true, note: 'per 10 persone, senza glutine' })
    expect(await spesa()).toContain('besciamella')
    // Chi è solo in lettura non affida incarichi.
    expect((await anna.scrivi('POST', `${P}/voci/v-lasagne/assegna`, { versione: libero.versione, esternoId: 'e-anna2' })).statusCode).toBe(403)
  })

  it('nome libero: occasionale, salvato in rubrica, oppure riconosciuto come persona già nota', async () => {
    const c1 = await ok(t.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-vino', nome: 'Vino rosso', quantitaNumero: 4, unita: 'bottiglie', note: 'del Piemonte' }))
    expect(c1).toMatchObject({ quantitaNumero: 4, unita: 'bottiglie', note: 'del Piemonte', stato: 'da_assegnare' })
    const occasionale = await ok(t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: c1.versione, nome: 'Il vicino Gino' }))
    expect(occasionale).toMatchObject({ incaricato: 'Il vicino Gino', incaricatoEsternoId: null, incaricatoId: null })
    expect(corpo(await t.leggi(`${P}/famiglie/${G}/rubrica`))).toEqual([])
    const salvato = await ok(t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: occasionale.versione, nome: 'Zio Marco', salvaInRubrica: true }))
    expect(salvato.incaricatoEsternoId).not.toBeNull()
    expect(corpo(await t.leggi(`${P}/famiglie/${G}/rubrica`)).map((e: { nome: string }) => e.nome)).toEqual(['Zio Marco'])
    // Lo stesso nome scritto di nuovo: la stessa persona della rubrica (nessun doppione).
    const di_nuovo = await ok(t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: salvato.versione, nome: 'zio marco', salvaInRubrica: true }))
    expect(di_nuovo.incaricatoEsternoId).toBe(salvato.incaricatoEsternoId)
    // Il nome di un invitato con l'app diventa quell'utente; quello di un membro non invitato no.
    const utente = await ok(t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: di_nuovo.versione, nome: 'anna' }))
    expect(utente).toMatchObject({ incaricato: 'Anna', incaricatoId: anna.id, incaricatoEsternoId: null })
    t.utente('Carla')
    expect(corpo(await t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: utente.versione, nome: 'Carla' })).errore.dettagli.regola).toBe('membro_non_invitato')
    // Una sola scelta per volta.
    expect((await t.scrivi('POST', `${P}/cose/c-vino/assegna`, { versione: utente.versione, nome: 'X', esternoId: 'e' })).statusCode).toBe(400)
  })

  it('isolamento: una persona della rubrica di un\'altra Famiglia non si usa (404)', async () => {
    esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Altra', 1, 1)")
    esegui(t.db, `INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('altra', '${estraneo.id}', 'amministratore', 1)`)
    await ok(estraneo.scrivi('POST', `${P}/famiglie/altra/rubrica`, { id: 'e-altro', nome: 'Zio di altri' }))
    const v = await incarico(t, 'v-lasagne')
    expect((await t.scrivi('POST', `${P}/voci/v-lasagne/assegna`, { versione: v.versione, esternoId: 'e-altro' })).statusCode).toBe(404)
    expect(corpo(await t.leggi(`${P}/eventi/ev/incarichi`)).rubrica).toEqual([])
    // Chi è solo in lettura non riceve la rubrica.
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-nostro', nome: 'Zio nostro' }))
    expect(corpo(await anna.leggi(`${P}/eventi/ev/incarichi`)).rubrica).toEqual([])
    expect(corpo(await bruno.leggi(`${P}/eventi/ev/incarichi`)).rubrica).toEqual([{ id: 'e-nostro', nome: 'Zio nostro' }])
  })

  it('«A cura di» scritto a mano a un altro nome scollega la persona della rubrica; mai due responsabili', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/rubrica`, { id: 'e-maria', nome: 'Nonna Maria' }))
    const v = await incarico(t, 'v-lasagne')
    await ok(t.scrivi('POST', `${P}/voci/v-lasagne/assegna`, { versione: v.versione, esternoId: 'e-maria' }))
    const vm = corpo(await t.leggi(`${P}/voci/v-lasagne`))
    await ok(t.scrivi('PUT', `${P}/voci/v-lasagne`, { ...vm, incaricato: 'Zia Pina' }))
    expect(await incarico(t, 'v-lasagne')).toMatchObject({ incaricato: 'Zia Pina', incaricatoEsternoId: null })
    expect(() => esegui(t.db, `UPDATE voci_menu SET incaricato_id = '${anna.id}', incaricato_esterno_id = 'e-maria' WHERE id = 'v-lasagne'`)).toThrow(/due responsabili/)
  })
})
