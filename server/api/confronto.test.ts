// Confronto fra edizioni (SPEC §27): piatti mantenuti, aggiunti e tolti; omonimi; archivio;
// valutazioni storiche non trasferite; coperti e partecipanti; permessi e Famiglie.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaConfronto } from '../../src/contratto/edizioni.ts'
import { esegui } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string }
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const ing = (nome: string) => ({ id: `i-${nome}`, ordine: 0, testoOriginale: `100 g ${nome}`, nome, ingredienteId: null, quantita: 100, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const confronto = async (c: ClientDiProva, id: string, con: string) => SchemaConfronto.parse(await ok(c.leggi(`${P}/eventi/${id}/confronto?con=${con}`)))

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  for (const [id, nome] of [['p-lasagne', 'Lasagne'], ['p-tira-vecchio', 'Tiramisù'], ['p-tira-nuovo', 'Tiramisù al pistacchio'], ['p-cappone', 'Cappone']]) {
    await ok(t.scrivi('POST', `${P}/piatti`, { id, nome, porzioniBase: 6, ingredienti: [ing(`x-${id}`)] }))
  }
  const ev = await ok(t.scrivi('POST', `${P}/eventi`, { id: 'n26', nome: 'Natale 2026', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: 'Natale', adulti: 10, bambini: 2, coefficienteBambini: 0.5, note: '', gruppoId: G }))
  const [, primi, secondi, , dolci] = ev.portate
  await ok(t.scrivi('POST', `${P}/eventi/n26/voci`, {
    voci: [
      { id: 'v-lasagne', portataId: primi.id, nome: 'Lasagne', piattoId: 'p-lasagne' },
      { id: 'v-cappone', portataId: secondi.id, nome: 'Cappone', piattoId: 'p-cappone' },
      { id: 'v-tira', portataId: dolci.id, nome: 'Tiramisù', piattoId: 'p-tira-vecchio' },
      { id: 'v-pane', portataId: secondi.id, nome: 'Pane', porzioni: 12 },
    ],
  }))
  await ok(t.scrivi('POST', `${P}/eventi/n26/partecipanti`, { id: 'pa', nome: 'Zio Marco', stato: 'confermato' }))
  // Voti del 2026 (evento passato): riferiti a quelle preparazioni.
  esegui(t.db, "INSERT INTO valutazioni (evento_id, voce_id, utente_id, stelle, nome_piatto, portata, ricetta_origine_id, creato_il, aggiornato_il) VALUES ('n26', 'v-lasagne', 'utente-amministratore', 5, 'Lasagne', 'Primi', 'p-lasagne', 1, 1), ('n26', 'v-lasagne', ?, 4, 'Lasagne', 'Primi', 'p-lasagne', 1, 1), ('n26', 'v-cappone', ?, 3, 'Cappone', 'Secondi', 'p-cappone', 1, 1)", anna.id, anna.id)
  const e = corpo(await t.leggi(`${P}/eventi/n26`))
  await ok(t.scrivi('POST', `${P}/eventi/n26/archivia`, { versione: e.versione }))
  // Natale 2027: copia, poi menù cambiato.
  await ok(t.scrivi('POST', `${P}/eventi/n26/duplica`, { id: 'n27', nome: 'Natale 2027', data: '2027-12-25' }))
  const menu = corpo(await t.leggi(`${P}/eventi/n27/menu`))
  const voce = (nome: string) => menu.portate.flatMap((p: { voci: { id: string; nome: string; versione: number }[] }) => p.voci).find((v: { nome: string }) => v.nome === nome)
  await ok(t.scrivi('DELETE', `${P}/voci/${voce('Cappone').id}?versione=${voce('Cappone').versione}`))
  await ok(t.scrivi('DELETE', `${P}/voci/${voce('Tiramisù').id}?versione=${voce('Tiramisù').versione}`))
  const portate = menu.portate as { id: string; nome: string }[]
  await ok(t.scrivi('POST', `${P}/eventi/n27/voci`, {
    voci: [
      // Stesso nome del 2026 ma un'altra ricetta: non è lo stesso piatto.
      { id: 'w-tira', portataId: portate[4]!.id, nome: 'Tiramisù', piattoId: 'p-tira-nuovo' },
      { id: 'w-antipasto', portataId: portate[0]!.id, nome: 'Crostini' },
    ],
  }))
  const e27 = corpo(await t.leggi(`${P}/eventi/n27`))
  await ok(t.scrivi('PUT', `${P}/eventi/n27`, { ...e27, adulti: 14, portate: portate.map((p) => ({ id: p.id, nome: p.nome })) }))
})
afterEach(() => t.chiudi())

describe('confronta con l\'anno scorso', () => {
  it('mantenuti, aggiunti, non riproposti, omonimi, portate, coperti, partecipanti e voti storici', async () => {
    const c = await confronto(t, 'n27', 'n26')
    expect(c.ora).toMatchObject({ nome: 'Natale 2027', archiviato: false, coperti: { adulti: 14, bambini: 2, equivalenti: 15 }, partecipanti: null })
    expect(c.prima).toMatchObject({ nome: 'Natale 2026', archiviato: true, coperti: { adulti: 10, bambini: 2, equivalenti: 11 }, partecipanti: { confermati: 1, inAttesa: 0, assenti: 0 } })
    expect(c.mantenuti.map((m) => [m.ora.nome, m.corrispondenza, m.prima.porzioni, m.ora.porzioni])).toEqual([
      ['Lasagne', 'certa', 11, 15],
      // Pane non ha ricetta, ma la voce è la copia di quella del 2026: stesso piatto.
      ['Pane', 'certa', 12, 12],
    ])
    // Il voto riguarda la preparazione del 2026: la nuova edizione non lo eredita.
    expect(c.mantenuti[0]!.prima.valutazione).toEqual({ media: 4.5, numero: 2 })
    expect(c.mantenuti[0]!.ora.valutazione).toBeNull()
    expect(c.aggiunti.map((x) => [x.nome, x.omonimo])).toEqual([['Crostini', false], ['Tiramisù', true]])
    expect(c.nonRiproposti.map((x) => [x.nome, x.omonimo, x.valutazione?.media ?? null])).toEqual([['Cappone', false, 3], ['Tiramisù', true, null]])
    expect(c.portate).toEqual({ aggiunte: ['Antipasti'], tolte: [] })
  })

  it('voce aggiunta a mano: la ricetta d\'origine fa da identità; senza ricetta solo «incerta»', async () => {
    const menu = corpo(await t.leggi(`${P}/eventi/n27/menu`))
    const lasagne = menu.portate.flatMap((p: { voci: { id: string; nome: string; versione: number }[] }) => p.voci).find((v: { nome: string }) => v.nome === 'Lasagne')
    await ok(t.scrivi('DELETE', `${P}/voci/${lasagne.id}?versione=${lasagne.versione}`))
    await ok(t.scrivi('POST', `${P}/eventi/n27/voci`, { voci: [{ id: 'w-lasagne', portataId: menu.portate[1].id, nome: 'Lasagne al forno', piattoId: 'p-lasagne' }] }))
    expect((await confronto(t, 'n27', 'n26')).mantenuti.find((m) => m.prima.nome === 'Lasagne')).toMatchObject({ corrispondenza: 'certa', ora: { nome: 'Lasagne al forno' } })
    // Eliminata la ricetta, la voce nuova resta senza: il 2026 la riconosce dai voti, ma il legame è solo il nome.
    await ok(t.scrivi('PUT', `${P}/voci/w-lasagne`, { nome: 'Lasagne', piattoId: null, porzioni: null, incaricato: '', inSpesa: true, note: '', versione: 1 }))
    await ok(t.scrivi('DELETE', `${P}/piatti/p-lasagne?versione=1`))
    expect((await confronto(t, 'n27', 'n26')).mantenuti.find((m) => m.prima.nome === 'Lasagne')!.corrispondenza).toBe('incerta')
  })

  it('eventi non accessibili o di Famiglie diverse: nessun confronto', async () => {
    // Anna non vede nessuno dei due.
    expect((await anna.leggi(`${P}/eventi/n27/confronto?con=n26`)).statusCode).toBe(404)
    await ok(t.scrivi('PUT', `${P}/eventi/n27/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    // Vede n27 ma non n26: il confronto non rivela nulla del 2026.
    expect((await anna.leggi(`${P}/eventi/n27/confronto?con=n26`)).statusCode).toBe(404)
    esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('altra', 'Altra', 1, 1)")
    esegui(t.db, "INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('altra', 'utente-amministratore', 'membro', 1)")
    await ok(t.scrivi('POST', `${P}/eventi`, { id: 'x', nome: 'Altrove', data: '2027-01-01', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 2, bambini: 0, note: '', gruppoId: 'altra' }))
    expect(corpo(await t.leggi(`${P}/eventi/n27/confronto?con=x`)).errore.dettagli.regola).toBe('famiglie_diverse')
    expect((await t.leggi(`${P}/eventi/n27/confronto`)).statusCode).toBe(400)
  })
})
