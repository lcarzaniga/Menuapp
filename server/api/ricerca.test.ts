// Ricerca delle ricette per nome e ingredienti (SPEC §23): catalogo e sinonimi, ordine,
// permessi (le ricette private altrui non compaiono mai) e prestazioni sul database.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaRiepilogoPiatto } from '../../src/contratto/ricettario.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva
let anna: ClientDiProva & { id: string } // stessa Famiglia
let estraneo: ClientDiProva & { id: string } // nessuna Famiglia in comune
const P = '/api/v1'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok(r: Promise<{ statusCode: number; body: string }>) {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : undefined
}
const ing = (id: string, nome: string, ingredienteId: string | null = null) => ({ id, ordine: 0, testoOriginale: nome, nome, ingredienteId, quantita: null, quantitaMax: null, unita: null, scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })
const cerca = async (c: ClientDiProva, q: string) => corpo(await c.leggi(`${P}/piatti?q=${encodeURIComponent(q)}`)).map((p: { nome: string }) => p.nome)

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  estraneo = t.utente('Estraneo', 'utente', false)
  const reparto = corpo(await t.leggi(`${P}/reparti`))[0].id
  await ok(t.scrivi('POST', `${P}/ingredienti`, { id: 'ing-cime', nome: 'Cime di rapa', sinonimi: ['friarielli', 'rapini'], repartoId: reparto, unitaPreferita: null, scalaturaAbituale: 'proporzionale' }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-orecchiette', nome: 'Orecchiette pugliesi', ingredienti: [ing('i1', 'orecchiette'), ing('i2', 'cime di rapa', 'ing-cime'), ing('i3', 'acciughe')] }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-caprese', nome: 'Caprese', ingredienti: [ing('i4', 'mozzarella di bufala'), ing('i5', 'pomodori')] }))
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-pomodoro', nome: 'Pasta al pomodoro', ingredienti: [ing('i6', 'spaghetti'), ing('i7', 'passata')] }))
  // Privata di Loris (con gli stessi ingredienti) e ricetta di chi non è della Famiglia.
  await ok(t.scrivi('POST', `${P}/piatti`, { id: 'p-segreta', nome: 'Ricetta segreta', visibilita: 'privata', ingredienti: [ing('i8', 'pomodori'), ing('i9', 'friarielli')] }))
  await ok(estraneo.scrivi('POST', `${P}/piatti`, { id: 'p-altra', nome: 'Pomodori gratinati', ingredienti: [ing('i10', 'pomodori')] }))
})
afterEach(() => t.chiudi())

describe('ricerca delle ricette', () => {
  it('per nome e ingredienti; catalogo e sinonimi; senza accenti e maiuscole; più termini', async () => {
    expect(await cerca(anna, 'ORECCHIETTE')).toEqual(['Orecchiette pugliesi'])
    expect(await cerca(anna, 'rapa')).toEqual(['Orecchiette pugliesi'])
    expect(await cerca(anna, 'Friarielli')).toEqual(['Orecchiette pugliesi'])
    expect(await cerca(anna, 'rapini acciughe')).toEqual(['Orecchiette pugliesi'])
    expect(await cerca(anna, 'pomodoro')).toEqual(['Pasta al pomodoro', 'Caprese'])
    expect(await cerca(anna, 'pomodoro mozzarella')).toEqual(['Caprese', 'Pasta al pomodoro'])
    // Gli ingredienti servono alla ricerca e sono nel contratto.
    const elenco = corpo(await anna.leggi(`${P}/piatti`)).map((x: unknown) => SchemaRiepilogoPiatto.parse(x))
    expect(elenco.find((p: { id: string }) => p.id === 'p-orecchiette')!.ingredienti).toEqual(['Cime di rapa', 'acciughe', 'friarielli', 'orecchiette', 'rapini'])
  })

  it('permessi: le ricette private e quelle di altre Famiglie non si trovano neanche per ingrediente', async () => {
    expect(await cerca(t, 'friarielli')).toEqual(['Orecchiette pugliesi', 'Ricetta segreta'])
    expect(await cerca(anna, 'friarielli')).toEqual(['Orecchiette pugliesi'])
    expect(await cerca(anna, 'pomodori')).not.toContain('Pomodori gratinati')
    expect(await cerca(estraneo, 'pomodori')).toEqual(['Pomodori gratinati'])
    expect(await cerca(estraneo, 'rapini')).toEqual([])
  })

  it('prestazioni: elenco con gli ingredienti su 2000 ricette', async () => {
    const { db } = t
    const adesso = Date.now()
    db.exec('BEGIN')
    const piatto = db.prepare("INSERT INTO piatti (id, proprietario_id, nome, nome_norm, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?)")
    const riga = db.prepare("INSERT INTO ingredienti_piatto (id, piatto_id, ordine, testo_originale, nome, scalatura, stato_parsing, problemi_parsing) VALUES (?, ?, ?, ?, ?, 'proporzionale', 'certo', '[]')")
    const condivisa = db.prepare('INSERT INTO condivisioni_piatto_gruppo (piatto_id, gruppo_id, creato_il) VALUES (?, ?, ?)')
    for (let i = 0; i < 2000; i++) {
      piatto.run(`m${i}`, anna.id, `Ricetta ${i}`, `ricetta ${i}`, adesso, adesso)
      condivisa.run(`m${i}`, 'gruppo-famiglia', adesso)
      for (let k = 0; k < 12; k++) riga.run(`m${i}-${k}`, `m${i}`, k, `ingrediente ${(i + k) % 500}`, `ingrediente ${(i + k) % 500}`)
    }
    db.exec('COMMIT')
    const inizio = performance.now()
    const r = await anna.leggi(`${P}/piatti?q=${encodeURIComponent('ingrediente 42')}`)
    const ms = performance.now() - inizio
    console.log(`2000 ricette, ricerca dal server: ${ms.toFixed(0)} ms`)
    expect(corpo(r).length).toBeGreaterThan(0)
    expect(ms).toBeLessThan(1500)
  })
})
