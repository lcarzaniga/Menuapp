import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SchemaRispostaSpesa } from '../../src/contratto/spesa.ts'
import { esegui, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
})
afterEach(() => t.chiudi())
const corpo = (r: { body: string }) => JSON.parse(r.body)

const ing = (id: string, nome: string, extra: Record<string, unknown> = {}) => ({
  id, ordine: 0, testoOriginale: nome, nome, ingredienteId: null, quantita: null, quantitaMax: null, unita: null,
  scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [], ...extra,
})
const evento = { id: 'e', nome: 'Natale 2026', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 4, note: '' }

/** Natale: crostata (8 porzioni base, 200 g di burro) e tortellini senza ricetta. */
async function prepara() {
  await t.scrivi('POST', '/api/v1/eventi', evento)
  const ev = corpo(await t.leggi('/api/v1/eventi/e'))
  await t.scrivi('POST', '/api/v1/piatti', {
    id: 'crostata', nome: 'Crostata', porzioniBase: 8,
    ingredienti: [
      ing('c1', 'burro', { ingredienteId: 'ing-burro', quantita: 200, unita: 'g' }),
      ing('c2', 'farina', { ingredienteId: 'ing-farina-00', quantita: 300, unita: 'g' }),
      ing('c3', 'sale', { ingredienteId: 'ing-sale', unita: 'qb', scalatura: 'fissa' }),
      ing('c4', 'confettura'),
    ],
  })
  await t.scrivi('POST', '/api/v1/eventi/e/voci', {
    voci: [
      { id: 'v-crostata', portataId: ev.portate[4].id, nome: 'Crostata', piattoId: 'crostata' },
      { id: 'v-tortellini', portataId: ev.portate[1].id, nome: 'Tortellini' },
    ],
  })
  return ev
}
async function spesa() {
  return SchemaRispostaSpesa.parse(corpo(await t.leggi('/api/v1/eventi/e/spesa')))
}
const voce = (s: Awaited<ReturnType<typeof spesa>>, chiave: string) => s.voci.find((v) => v.chiave === chiave) as Record<string, unknown> & { versione: number }
const BURRO = 'ing:ing-burro|massa'
const riga = (chiave: string) => `/api/v1/eventi/e/spesa/righe/${encodeURIComponent(chiave)}`
const stato = (s: string, versione: number, extra: Record<string, unknown> = {}) => ({ stato: s, quantitaUtente: null, repartoId: null, nascosto: false, inclusa: false, nota: '', versione, ...extra })

describe('lista della spesa', () => {
  it('calcolata dal server: sommate, q.b., da verificare e avvisi', async () => {
    await prepara()
    const s = await spesa()
    // 10 coperti: burro 200 × 10/8 = 250 g
    expect(voce(s, BURRO)).toMatchObject({ quantita: 250, sezione: 'da_comprare', caso: 'R1', nome: 'burro', repartoId: 'rep-latte-uova-frigo' })
    expect(voce(s, 'ing:ing-sale|qb')).toMatchObject({ sezione: 'da_comprare', unita: 'qb' })
    expect(s.voci.find((v) => v.chiave.startsWith('dv:'))).toMatchObject({ sezione: 'da_verificare', motivi: ['quantità da definire'] })
    expect(s.avvisi.map((a) => a.tipo)).toEqual(['voce_senza_ricetta'])
    expect(s.solaLettura).toBe(false)
  })

  it('scenario a due dispositivi: comprato → coperti aumentati (R3) → piatto tolto (R5)', async () => {
    const ev = await prepara()
    // telefono: segna comprato il burro (fabbisogno coperto stabilito dal server = 250)
    const r1 = await t.scrivi('PUT', riga(BURRO), stato('comprato', 0))
    expect(r1.statusCode, r1.body).toBe(200)
    expect(corpo(r1)).toMatchObject({ stato: 'comprato', fabbisognoCoperto: 250, nome: 'burro', quantitaTesto: '250 g' })
    // PC: aumenta i bambini da 4 a 8 → 12 coperti → 300 g
    await t.scrivi('PUT', '/api/v1/eventi/e', { ...evento, bambini: 8, coefficienteBambini: 0.5, portate: ev.portate, versione: ev.versione })
    let s = await spesa()
    expect(voce(s, BURRO)).toMatchObject({ caso: 'R3', sezione: 'da_comprare', aumento: 50, quantita: 300, fabbisognoCoperto: 250 })
    // «Coperto anche l'aumento»
    const v = voce(s, BURRO)
    await t.scrivi('PUT', riga(BURRO), stato('comprato', v.versione, { aggiornaCopertura: true }))
    s = await spesa()
    expect(voce(s, BURRO)).toMatchObject({ caso: 'R2', sezione: 'comprato', fabbisognoCoperto: 300 })
    // PC: toglie la crostata dalla spesa
    const vc = corpo(await t.leggi('/api/v1/voci/v-crostata'))
    await t.scrivi('PUT', '/api/v1/voci/v-crostata', { nome: vc.nome, piattoId: vc.piattoId, porzioni: null, incaricato: '', inSpesa: false, note: '', versione: vc.versione })
    s = await spesa()
    expect(voce(s, BURRO)).toMatchObject({ caso: 'R5', sezione: 'non_piu_necessari', nome: 'burro', descrizioneOrfana: '300 g' })
  })

  it('cambiare stato senza toccare il fabbisogno; conflitto fra dispositivi', async () => {
    await prepara()
    await t.scrivi('PUT', riga(BURRO), stato('ce_lho', 0))
    const conflitto = await t.scrivi('PUT', riga(BURRO), stato('comprato', 0))
    expect(conflitto.statusCode).toBe(409)
    const nota = await t.scrivi('PUT', riga(BURRO), stato('ce_lho', 1, { nota: 'presi 2 panetti su 3' }))
    expect(corpo(nota)).toMatchObject({ fabbisognoCoperto: 250, nota: 'presi 2 panetti su 3', versione: 2 })
    const indietro = await t.scrivi('PUT', riga(BURRO), stato('da_comprare', 2))
    expect(corpo(indietro).fabbisognoCoperto).toBeNull()
  })

  it('correzione dell\'utente (R7) e riga inesistente (404)', async () => {
    const ev = await prepara()
    await t.scrivi('PUT', riga(BURRO), stato('da_comprare', 0, { quantitaUtente: 500 }))
    await t.scrivi('PUT', '/api/v1/eventi/e', { ...evento, adulti: 16, coefficienteBambini: 0.5, portate: ev.portate, versione: ev.versione })
    const s = await spesa()
    expect(voce(s, BURRO)).toMatchObject({ caso: 'R7', quantita: 500, quantitaCalcolata: 450, correzione: { calcolataOra: 450, allaCorrezione: 250 } })
    expect((await t.scrivi('PUT', riga('ing:ing-nulla|massa'), stato('comprato', 0))).statusCode).toBe(404)
  })

  it('ripulisci (R6) e trasferisci (R10)', async () => {
    await prepara()
    esegui(t.db, "INSERT INTO articoli_spesa (id, evento_id, tipo, chiave, creato_il, aggiornato_il) VALUES ('x', 'e', 'calcolato', 'txt:vecchio|massa', 1, 1)")
    expect(corpo(await t.scrivi('POST', '/api/v1/eventi/e/spesa/ripulisci', {})).eliminati).toBe(1)
    // il burro della crostata passa da grammi a confezioni: la chiave cambia
    await t.scrivi('PUT', riga(BURRO), stato('comprato', 0))
    const p = corpo(await t.leggi('/api/v1/piatti/crostata'))
    p.ingredienti[0] = { ...p.ingredienti[0], quantita: 1, unita: 'confezione' }
    await t.scrivi('PUT', '/api/v1/piatti/crostata', p)
    let s = await spesa()
    expect(voce(s, BURRO)).toMatchObject({ caso: 'R5', trasferibileA: { chiave: 'ing:ing-burro|u:confezione' } })
    const r = await t.scrivi('POST', '/api/v1/eventi/e/spesa/trasferisci', { da: BURRO, a: 'ing:ing-burro|u:confezione', versione: 1 })
    expect(r.statusCode, r.body).toBe(200)
    s = await spesa()
    expect(voce(s, BURRO)).toBeUndefined()
    expect(voce(s, 'ing:ing-burro|u:confezione')).toMatchObject({ stato: 'comprato', fabbisognoCoperto: null })
  })

  it('articoli manuali indipendenti', async () => {
    await prepara()
    const r = await t.scrivi('POST', '/api/v1/eventi/e/spesa/manuali', { id: 'm1', nome: 'Ghiaccio', quantitaTesto: '2 sacchetti', repartoId: 'rep-casa-tavola', nota: '' })
    expect(r.statusCode).toBe(201)
    await t.scrivi('PUT', '/api/v1/spesa/manuali/m1', { nome: 'Ghiaccio', quantitaTesto: '3 sacchetti', repartoId: 'rep-casa-tavola', nota: '', stato: 'comprato', versione: 1 })
    expect((await spesa()).manuali).toMatchObject([{ nome: 'Ghiaccio', quantitaTesto: '3 sacchetti', sezione: 'comprato' }])
    expect((await t.scrivi('DELETE', '/api/v1/spesa/manuali/m1?versione=2')).statusCode).toBe(204)
  })
})

describe('archivio e piano', () => {
  it('snapshot autonomo: menù, spesa e piano non cambiano dopo modifiche ai dati vivi', async () => {
    const ev = await prepara()
    await t.scrivi('POST', '/api/v1/eventi/e/attivita', { id: 'a1', titolo: 'Preparare la frolla', data: '2026-12-24', ora: null, voceMenuId: 'v-crostata', note: '' })
    await t.scrivi('PUT', riga(BURRO), stato('comprato', 0))
    const arch = await t.scrivi('POST', '/api/v1/eventi/e/archivia', { versione: ev.versione })
    expect(arch.statusCode, arch.body).toBe(200)
    expect(corpo(arch).stato).toBe('archiviato')
    // modifiche successive: piatto cambiato ed eliminato, attività toccata direttamente
    const p = corpo(await t.leggi('/api/v1/piatti/crostata'))
    await t.scrivi('PUT', '/api/v1/piatti/crostata', { ...p, nome: 'Crostata nuova', ingredienti: [] })
    esegui(t.db, "UPDATE attivita SET titolo = 'cambiato'")
    const menu = corpo(await t.leggi('/api/v1/eventi/e/menu'))
    expect(menu.portate[4].voci[0]).toMatchObject({ nome: 'Crostata', piattoNome: 'Crostata' })
    const s = await spesa()
    expect(s.solaLettura).toBe(true)
    expect(voce(s, BURRO)).toMatchObject({ quantita: 250, stato: 'comprato' })
    expect(corpo(await t.leggi('/api/v1/eventi/e/attivita'))[0].titolo).toBe('Preparare la frolla')
    const snap = corpo(await t.leggi('/api/v1/eventi/e/snapshot'))[0]
    expect(snap.contenuto.piatti[0]).toMatchObject({ nome: 'Crostata', ingredienti: [{ nome: 'burro', ingredienteNome: 'burro', repartoNome: 'Latte, uova e frigo' }, {}, {}, {}] })
    // sola lettura
    expect((await t.scrivi('PUT', riga(BURRO), stato('da_comprare', 1))).statusCode).toBe(422)
    expect((await t.scrivi('POST', '/api/v1/eventi/e/attivita', { id: 'a2', titolo: 'x', data: '2026-12-24', ora: null, voceMenuId: null, note: '' })).statusCode).toBe(422)
    // copia nel ricettario: nuovo piatto, l'esistente non cambia
    const copia = await t.scrivi('POST', `/api/v1/snapshot/${snap.id}/copia-piatto`, { piattoId: 'crostata', nuovoId: 'crostata-2026' })
    expect(corpo(copia)).toMatchObject({ nome: 'Crostata (Natale 2026)', porzioniBase: 8 })
    expect(corpo(copia).ingredienti).toHaveLength(4)
    expect(corpo(await t.leggi('/api/v1/piatti/crostata')).nome).toBe('Crostata nuova')
    // riapertura: informazione sui piatti cambiati, nessun piatto modificato, snapshot superato
    expect(corpo(await t.leggi('/api/v1/eventi/e/riapertura')).piattiCambiati).toEqual([{ dishId: 'crostata', nome: 'Crostata', esito: 'modificato' }])
    const e2 = corpo(await t.leggi('/api/v1/eventi/e'))
    const riaperto = await t.scrivi('POST', '/api/v1/eventi/e/riapri', { versione: e2.versione })
    expect(corpo(riaperto).stato).toBe('attivo')
    expect(uno(t.db, "SELECT stato FROM snapshot_eventi WHERE evento_id = 'e'")).toEqual({ stato: 'superato' })
    expect(corpo(await t.leggi('/api/v1/piatti/crostata')).nome).toBe('Crostata nuova')
    expect(corpo(await t.leggi('/api/v1/eventi/e/attivita'))[0].titolo).toBe('cambiato')
  })

  it('attività: ordine, voce di un altro evento rifiutata, spostamento di N giorni', async () => {
    await prepara()
    await t.scrivi('POST', '/api/v1/eventi/e/attivita', { id: 'a1', titolo: 'Apparecchiare', data: '2026-12-25', ora: '11:00', voceMenuId: null, note: '' })
    await t.scrivi('POST', '/api/v1/eventi/e/attivita', { id: 'a2', titolo: 'Spesa', data: '2026-12-23', ora: null, voceMenuId: null, note: '' })
    await t.scrivi('POST', '/api/v1/eventi/e/attivita', { id: 'a3', titolo: 'Brodo', data: '2026-12-25', ora: null, voceMenuId: 'v-tortellini', note: '' })
    expect(corpo(await t.leggi('/api/v1/eventi/e/attivita')).map((a: { titolo: string }) => a.titolo)).toEqual(['Spesa', 'Brodo', 'Apparecchiare'])
    await t.scrivi('POST', '/api/v1/eventi', { ...evento, id: 'e2', nome: 'Altro' })
    expect((await t.scrivi('POST', '/api/v1/eventi/e2/attivita', { id: 'x', titolo: 'x', data: '2026-12-25', ora: null, voceMenuId: 'v-tortellini', note: '' })).statusCode).toBe(422)
    const fatto = await t.scrivi('PUT', '/api/v1/attivita/a2', { titolo: 'Spesa', data: '2026-12-23', ora: null, voceMenuId: null, note: '', stato: 'fatto', versione: 1 })
    expect(corpo(fatto).stato).toBe('fatto')
    const spostate = corpo(await t.scrivi('POST', '/api/v1/eventi/e/attivita/sposta', { giorni: 7 }))
    expect(spostate.map((a: { data: string }) => a.data)).toEqual(['2026-12-30', '2027-01-01', '2027-01-01'])
    // eliminare la voce lascia l'attività senza collegamento
    await t.scrivi('DELETE', '/api/v1/voci/v-tortellini?versione=1')
    expect(uno(t.db, "SELECT voce_menu_id FROM attivita WHERE id = 'a3'")).toEqual({ voce_menu_id: null })
  })
})
