// «A che punto siamo?» (SPEC §26): indicatori coerenti con i dati, nessun falso allarme,
// aggiornamento dopo partecipanti e incarichi, eventi senza funzioni collaborative.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaRiepilogoEvento } from '../../src/contratto/edizioni.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
let estraneo: ClientDiProva & { id: string }
const P = '/api/v1'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const riepilogo = async (c: ClientDiProva = t) => SchemaRiepilogoEvento.parse(corpo(await c.leggi(`${P}/eventi/ev/riepilogo`)))
const ing = (nome: string) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `100 g ${nome}`, nome, ingredienteId: null, quantita: 100, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
let portate: { id: string }[]

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  estraneo = t.utente('Estraneo', 'utente', false)
  portate = (await ok(t.scrivi('POST', `${P}/eventi`, { id: 'ev', nome: 'Cena', data: '2030-06-01', oraServizio: null, tipo: 'cena', occasione: '', adulti: 6, bambini: 2, coefficienteBambini: 0.5, note: '', gruppoId: 'gruppo-famiglia' }))).portate
  await ok(t.scrivi('PUT', `${P}/eventi/ev/condivisioni/${anna.id}`, { permesso: 'lettura' }))
})
afterEach(() => t.chiudi())

describe('a che punto siamo', () => {
  it('evento semplice: solo i coperti; piatti preparati da chi organizza non sono un allarme', async () => {
    expect(await riepilogo()).toEqual({
      menu: { voci: 0, portateVuote: ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Frutta e caffè', 'Bevande'] },
      coperti: { equivalenti: 7, adulti: 6, bambini: 2, automatici: false },
      partecipanti: null,
      incarichi: null,
      attivita: null,
      proposte: null,
      sondaggi: null,
      spesa: null,
      archiviato: false,
    })
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, { voci: [{ id: 'v1', portataId: portate[1]!.id, nome: 'Risotto' }, { id: 'v2', portataId: portate[2]!.id, nome: 'Arrosto' }] }))
    // Il menù non è più vuoto ma è in preparazione: restano portate senza piatti (SPEC §26).
    expect(await riepilogo()).toMatchObject({ menu: { voci: 2, portateVuote: ['Antipasti', 'Contorni', 'Dolci', 'Frutta e caffè', 'Bevande'] }, incarichi: null })
    // Le portate che non servono si tolgono: con ogni portata riempita il menù è completato.
    const e = corpo(await t.leggi(`${P}/eventi/ev`))
    await ok(t.scrivi('PUT', `${P}/eventi/ev`, { ...e, portate: [portate[1], portate[2]], versione: e.versione }))
    expect((await riepilogo()).menu).toEqual({ voci: 2, portateVuote: [] })
    // Chi non vede l'evento non ne vede il riepilogo.
    expect((await estraneo.leggi(`${P}/eventi/ev/riepilogo`)).statusCode).toBe(404)
  })

  it('indicatori coerenti e aggiornati dopo partecipanti, incarichi, piano, bacheca e spesa', async () => {
    await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-torta', nome: 'Torta', porzioniBase: 8, ingredienti: [ing('farina'), ing('uova')] }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/voci`, {
      voci: [
        { id: 'v1', portataId: portate[1]!.id, nome: 'Risotto' },
        { id: 'v2', portataId: portate[4]!.id, nome: 'Torta', piattoId: 'p-torta' },
      ],
    }))
    // Partecipanti: Anna (con l'app) in attesa, Marco confermato con un bambino.
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'pa', utenteId: anna.id }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'pm', nome: 'Zio Marco', stato: 'confermato' }))
    await ok(t.scrivi('PUT', `${P}/partecipanti/pm/accompagnatori`, { anonimi: { adultiConfermati: 0, adultiInAttesa: 0, bambiniConfermati: 1, bambiniInAttesa: 0 }, versione: 1 }))
    let r = await riepilogo(anna)
    expect(r.partecipanti).toEqual({ confermati: 2, inAttesa: 1, assenti: 0 })
    expect(r).not.toHaveProperty('mioInvito')
    // Le presenze le registra chi organizza (SPEC §29.2).
    await ok(t.scrivi('PUT', `${P}/partecipanti/pa`, { nome: 'Anna', categoria: 'adulto', stato: 'confermato', note: '', versione: 1 }))
    r = await riepilogo(anna)
    expect(r).toMatchObject({ partecipanti: { confermati: 3, inAttesa: 0 } })
    // Incarichi: la torta a Zio Marco, il vino ancora senza nessuno.
    const torta = corpo(await t.leggi(`${P}/eventi/ev/incarichi`)).incarichi.find((i: { id: string }) => i.id === 'v2')
    await ok(t.scrivi('POST', `${P}/voci/v2/assegna`, { versione: torta.versione, partecipanteId: 'pm', togliDallaSpesa: true }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/cose`, { id: 'c-vino', nome: 'Vino' }))
    r = await riepilogo()
    expect(r.incarichi).toEqual({ coseSenzaResponsabile: 1, daCompletare: 1, piattiNonAffidati: 1, responsabiliAssenti: 0 })
    // La torta è fuori dalla spesa e nessun altro piatto ha ricetta: niente da comprare.
    expect(r.spesa).toBeNull()
    await ok(t.scrivi('PUT', `${P}/partecipanti/pm`, { nome: 'Zio Marco', categoria: 'adulto', stato: 'assente', note: '', versione: 2 }))
    expect((await riepilogo()).incarichi).toMatchObject({ responsabiliAssenti: 1 })
    await ok(t.scrivi('POST', `${P}/voci/v2/completa`, { versione: torta.versione + 1, completato: true }))
    expect((await riepilogo()).incarichi).toMatchObject({ daCompletare: 0 })
    // Piano: una attività in ritardo e una futura.
    await ok(t.scrivi('POST', `${P}/eventi/ev/attivita`, { id: 'a1', titolo: 'Ordinare il pesce', data: '2020-01-01', ora: null, voceMenuId: null, note: '' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/attivita`, { id: 'a2', titolo: 'Apparecchiare', data: '2030-06-01', ora: null, voceMenuId: null, note: '' }))
    expect((await riepilogo()).attivita).toEqual({ daFare: 2, inRitardo: 1 })
    // Bacheca: una proposta da decidere e un sondaggio aperto.
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'm1', testo: 'Che ne dite?', proposta: { nome: 'Tiramisù', portataNome: 'Dolci' } }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/messaggi`, { id: 'm2', testo: 'Che ora?', sondaggio: { opzioni: ['12', '13'] } }))
    r = await riepilogo()
    expect(r).toMatchObject({ proposte: { inAttesa: 1 }, sondaggi: { aperti: 1 } })
    // La spesa compare quando c'è qualcosa da comprare.
    await ok(t.scrivi('POST', `${P}/voci/v2/rinuncia`, { versione: torta.versione + 2 }))
    expect((await riepilogo()).spesa).toEqual({ daComprare: 2, daVerificare: 0, avvisi: expect.any(Number) })
  })

  it('evento archiviato: coperti e partecipanti, nessuna cosa da fare', async () => {
    await ok(t.scrivi('POST', `${P}/eventi/ev/partecipanti`, { id: 'pm', nome: 'Zio Marco', stato: 'confermato' }))
    await ok(t.scrivi('POST', `${P}/eventi/ev/attivita`, { id: 'a1', titolo: 'X', data: '2020-01-01', ora: null, voceMenuId: null, note: '' }))
    const e = corpo(await t.leggi(`${P}/eventi/ev`))
    await ok(t.scrivi('POST', `${P}/eventi/ev/archivia`, { versione: e.versione }))
    expect(await riepilogo()).toMatchObject({ archiviato: true, partecipanti: { confermati: 1 }, attivita: null, incarichi: null })
  })
})
