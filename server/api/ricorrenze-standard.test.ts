// Ricorrenze standard (SPEC §30): catalogo unico per tutte le Famiglie, associazione automatica
// dall'occasione alla creazione, scelte manuali che prevalgono e restano, duplicazione, edizioni
// e confronto dentro la Famiglia, omonimie con le ricorrenze della Famiglia, permessi, backup e
// migrazione 0015 (associazioni esistenti conservate, nessuna associazione in massa).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RICORRENZE_STANDARD, standardPerOccasione } from '../../src/domain/ricorrenze.ts'
import { esegui, tutti, uno } from '../db/connessione.ts'
import { apriDatabase, chiudiDatabase } from '../db/sqlite-node.ts'
import { applicaMigrazioni } from '../db/migrazioni/esegui.ts'
import { appDiProva, type AppDiProva, type ClientDiProva } from '../prova.ts'

let t: AppDiProva // Loris, amministratore della Famiglia
let anna: ClientDiProva & { id: string } // della Famiglia e dei Rossi
let carla: ClientDiProva & { id: string } // solo dei Rossi
const P = '/api/v1'
const G = 'gruppo-famiglia'
const corpo = (r: { body: string }) => JSON.parse(r.body)
async function ok<T = any>(r: Promise<{ statusCode: number; body: string }>): Promise<T> {
  const x = await r
  expect(x.statusCode, x.body).toBeLessThan(300)
  return x.body ? JSON.parse(x.body) : (undefined as T)
}
const regola = async (r: Promise<{ statusCode: number; body: string }>) => corpo(await r).errore?.dettagli?.regola
const evento = (c: ClientDiProva, id: string, data: string, occasione: string, extra: Record<string, unknown> = {}) =>
  ok(c.scrivi('POST', `${P}/eventi`, { id, nome: `${occasione || 'Pranzo'} ${data.slice(0, 4)}`, data, oraServizio: '20:00', tipo: 'cena', occasione, adulti: 8, bambini: 0, note: '', gruppoId: G, ...extra }))
const leggi = async (id: string, c: ClientDiProva = t) => corpo(await c.leggi(`${P}/eventi/${id}`))
const edizioni = async (id: string, c: ClientDiProva = t) => ok(c.leggi(`${P}/eventi/${id}/edizioni`))
const associa = (id: string, ricorrenza: unknown, c: ClientDiProva = t) => c.scrivi('PUT', `${P}/eventi/${id}/ricorrenza`, { ricorrenza })
/** Modifica di nome, data e occasione (gli altri campi restano). */
async function modifica(id: string, campi: Record<string, unknown>) {
  const e = await leggi(id)
  return ok(t.scrivi('PUT', `${P}/eventi/${id}`, { nome: e.nome, data: e.data, oraServizio: e.oraServizio, tipo: e.tipo, occasione: e.occasione, adulti: e.adulti, bambini: e.bambini, coefficienteBambini: e.coefficienteBambini, note: e.note, portate: e.portate, versione: e.versione, ...campi }))
}
const VIGILIA = { tipo: 'standard', id: 'vigilia-natale' }

beforeEach(async () => {
  t = await appDiProva()
  anna = t.utente('Anna')
  carla = t.utente('Carla', 'utente', false)
  esegui(t.db, "INSERT INTO gruppi (id, nome, creato_il, aggiornato_il) VALUES ('rossi', 'Famiglia Rossi', 1, 1)")
  esegui(t.db, `INSERT INTO membri_gruppo (gruppo_id, utente_id, ruolo, creato_il) VALUES ('rossi', '${anna.id}', 'amministratore', 1), ('rossi', '${carla.id}', 'membro', 1)`)
})
afterEach(() => t.chiudi())

describe('catalogo', () => {
  it('otto ricorrenze con id stabili; riconosciute solo dall\'occasione esatta (senza accenti e maiuscole)', () => {
    expect(RICORRENZE_STANDARD.map((r) => r.id)).toEqual(['vigilia-natale', 'natale', 'santo-stefano', 'capodanno', 'epifania', 'pasqua', 'pasquetta', 'ferragosto'])
    expect(standardPerOccasione('vigilia di natale')?.id).toBe('vigilia-natale')
    expect(standardPerOccasione('  PASQUETTA ')?.id).toBe('pasquetta')
    expect(standardPerOccasione('Lunedi dell\'Angelo')?.id).toBe('pasquetta')
    for (const o of ['', 'Natale dai nonni', 'Compleanno', 'Pranzo di Natale']) expect(standardPerOccasione(o)).toBeUndefined()
  })
})

describe('associazione automatica e scelte manuali', () => {
  it('«Vigilia di Natale» nasce nella ricorrenza standard; le scelte manuali prevalgono e restano dopo titolo e data', async () => {
    // 1–2. Creazione: associazione automatica, nessuna riga di ricorrenza creata nella Famiglia.
    const e = await evento(t, 'v26', '2026-12-24', 'Vigilia di Natale')
    expect(e).toMatchObject({ ricorrenzaStandard: 'vigilia-natale', ricorrenzaId: null })
    expect(uno(t.db, 'SELECT count(*) AS n FROM ricorrenze')).toEqual({ n: 0 })
    expect(await edizioni('v26')).toMatchObject({ ricorrenza: { tipo: 'standard', id: 'vigilia-natale', nome: 'Vigilia di Natale' }, suggerita: null })
    expect((await edizioni('v26')).standard).toHaveLength(8)
    // 3. Un'altra standard, poi una della Famiglia.
    expect((await ok(associa('v26', { tipo: 'standard', id: 'natale' }))).ricorrenza).toMatchObject({ tipo: 'standard', id: 'natale' })
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/ricorrenze`, { id: 'r-cenone', nome: 'Cenone dai nonni' }))
    expect((await ok(associa('v26', { tipo: 'famiglia', id: 'r-cenone' }))).ricorrenza).toMatchObject({ tipo: 'famiglia', id: 'r-cenone' })
    expect(await leggi('v26')).toMatchObject({ ricorrenzaId: 'r-cenone', ricorrenzaStandard: null })
    // 4. Tolta: nessuna, e l'app non la ripropone.
    expect(await ok(associa('v26', null))).toMatchObject({ ricorrenza: null, suggerita: null })
    // 5. Titolo e data cambiano: la scelta resta (anche l'assenza).
    await modifica('v26', { nome: 'La nostra vigilia', data: '2026-12-23' })
    expect(await leggi('v26')).toMatchObject({ ricorrenzaId: null, ricorrenzaStandard: null })
    expect((await edizioni('v26')).suggerita).toBeNull()
    await ok(associa('v26', VIGILIA))
    await modifica('v26', { nome: 'Vigilia 2026 dai nonni', data: '2026-12-24', note: 'Pesce' })
    expect((await leggi('v26')).ricorrenzaStandard).toBe('vigilia-natale')
  })

  it('cambiando l\'occasione si propone la nuova ricorrenza, senza sostituire quella scelta', async () => {
    await evento(t, 'e1', '2026-12-25', 'Natale')
    await ok(associa('e1', null))
    await modifica('e1', { occasione: 'Santo Stefano' })
    const d = await edizioni('e1')
    expect(d).toMatchObject({ ricorrenza: null, suggerita: { id: 'santo-stefano', nome: 'Santo Stefano' } })
    expect((await leggi('e1')).ricorrenzaStandard).toBeNull()
    // Rifiutare la proposta (confermare «nessuna») la fa sparire.
    await ok(associa('e1', null))
    expect((await edizioni('e1')).suggerita).toBeNull()
    // Anche un'associazione automatica non si sostituisce da sola: si propone.
    await evento(t, 'e2', '2027-04-04', 'Pasqua')
    await modifica('e2', { occasione: 'Pasquetta' })
    expect(await leggi('e2')).toMatchObject({ ricorrenzaStandard: 'pasqua' })
    expect((await edizioni('e2')).suggerita).toMatchObject({ id: 'pasquetta' })
    expect((await ok(associa('e2', { tipo: 'standard', id: 'pasquetta' }))).suggerita).toBeNull()
  })

  it('scelta esplicita alla creazione (anche nessuna); eventi senza occasione standard; eventi personali', async () => {
    expect(await evento(t, 'a', '2026-12-24', 'Vigilia di Natale', { ricorrenza: null })).toMatchObject({ ricorrenzaStandard: null })
    expect((await edizioni('a')).suggerita).toBeNull()
    expect(await evento(t, 'b', '2026-12-24', 'Vigilia di Natale', { ricorrenza: { tipo: 'standard', id: 'natale' } })).toMatchObject({ ricorrenzaStandard: 'natale' })
    // 10. Nessun tipo standard: nessuna ricorrenza, nessuna proposta.
    for (const [id, occasione] of [['c', 'Compleanno di Giulia'], ['d', ''], ['e', 'Natale dai nonni']]) {
      expect(await evento(t, id!, '2026-06-01', occasione!)).toMatchObject({ ricorrenzaId: null, ricorrenzaStandard: null })
      expect((await edizioni(id!)).suggerita).toBeNull()
    }
    // Evento personale: niente associazione automatica; una scelta esplicita è rifiutata.
    expect(await evento(t, 'p', '2026-12-25', 'Natale', { gruppoId: null })).toMatchObject({ ricorrenzaStandard: null })
    expect(await regola(t.scrivi('POST', `${P}/eventi`, { id: 'p2', nome: 'x', data: '2026-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 1, bambini: 0, note: '', gruppoId: null, ricorrenza: VIGILIA }))).toBe('evento_personale')
    expect(await regola(associa('p', VIGILIA))).toBe('evento_personale')
    // Un id fuori dal catalogo non passa la validazione.
    expect((await associa('a', { tipo: 'standard', id: 'halloween' })).statusCode).toBe(400)
    // Il database non ammette due ricorrenze insieme.
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/ricorrenze`, { id: 'r1', nome: 'R1' }))
    expect(() => esegui(t.db, "UPDATE eventi SET ricorrenza_id = 'r1' WHERE id = 'b'")).toThrow(/una sola ricorrenza/)
  })
})

describe('duplicazione, edizioni e confronto', () => {
  it('la copia resta nella ricorrenza standard; le edizioni della stessa Famiglia si ritrovano e si confrontano', async () => {
    const v26 = await evento(t, 'v26', '2026-12-24', 'Vigilia di Natale')
    await ok(t.scrivi('POST', `${P}/eventi/v26/voci`, { voci: [{ id: 'v1', portataId: v26.portate[1].id, nome: 'Spaghetti alle vongole' }] }))
    // 6. Duplicazione: stessa associazione, nessuna nuova definizione.
    const v27 = (await ok(t.scrivi('POST', `${P}/eventi/v26/duplica`, { id: 'v27', nome: 'Vigilia di Natale 2027', data: '2027-12-24' }))).evento
    expect(v27).toMatchObject({ ricorrenzaStandard: 'vigilia-natale', ricorrenzaId: null })
    expect(uno(t.db, 'SELECT count(*) AS n FROM ricorrenze')).toEqual({ n: 0 })
    // Cambiata o tolta duplicando, se lo si chiede.
    expect((await ok(t.scrivi('POST', `${P}/eventi/v26/duplica`, { id: 'x1', nome: 'x', data: '2028-12-24', ricorrenza: null }))).evento.ricorrenzaStandard).toBeNull()
    expect((await ok(t.scrivi('POST', `${P}/eventi/v26/duplica`, { id: 'x2', nome: 'x', data: '2028-12-25', ricorrenza: { tipo: 'standard', id: 'natale' } }))).evento.ricorrenzaStandard).toBe('natale')
    // Anche verso un'altra Famiglia la standard resta (vale ovunque).
    await ok(t.scrivi('PUT', `${P}/eventi/v26/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    expect((await ok(anna.scrivi('POST', `${P}/eventi/v26/duplica`, { id: 'r27', nome: 'Vigilia dai Rossi', data: '2027-12-24', gruppoId: 'rossi' }))).evento.ricorrenzaStandard).toBe('vigilia-natale')
    // 7. Edizioni e confronto: solo la stessa Famiglia.
    const d = await edizioni('v27')
    expect(d.edizioni.map((x: { id: string }) => x.id)).toEqual(['v26'])
    const c = await ok(t.leggi(`${P}/eventi/v27/confronto?con=v26`))
    expect(c.mantenuti.map((m: { ora: { nome: string } }) => m.ora.nome)).toEqual(['Spaghetti alle vongole'])
    expect(c.mantenuti[0].corrispondenza).toBe('certa')
    // 8. Isolamento: la Vigilia dei Rossi non è un'edizione della Famiglia, e viceversa.
    expect((await edizioni('r27', anna)).edizioni).toEqual([])
    expect((await t.leggi(`${P}/eventi/v27/confronto?con=r27`)).statusCode).toBe(404)
    expect((await anna.leggi(`${P}/eventi/r27/confronto?con=v26`)).statusCode).toBe(422)
  })

  it('archiviare non cambia l\'associazione; l\'archivio duplicato resta nella ricorrenza', async () => {
    const e = await evento(t, 'p26', '2026-04-05', 'Pasqua')
    await ok(t.scrivi('POST', `${P}/eventi/p26/archivia`, { versione: e.versione }))
    expect((await leggi('p26')).ricorrenzaStandard).toBe('pasqua')
    expect((await ok(t.scrivi('POST', `${P}/eventi/p26/duplica`, { id: 'p27', nome: 'Pasqua 2027', data: '2027-03-28' }))).evento.ricorrenzaStandard).toBe('pasqua')
    expect((await edizioni('p27')).edizioni.map((x: { id: string }) => x.id)).toEqual(['p26'])
    // L'evento archiviato non si riassocia.
    expect((await associa('p26', null)).statusCode).toBe(422)
  })
})

describe('ricorrenze della Famiglia omonime, permessi, spostamenti', () => {
  it('una ricorrenza della Famiglia «Natale» resta distinta dalla standard e non viene toccata', async () => {
    await ok(t.scrivi('POST', `${P}/famiglie/${G}/ricorrenze`, { id: 'r-natale', nome: 'Natale' }))
    const prima = tutti(t.db, 'SELECT * FROM ricorrenze')
    await evento(t, 'n26', '2026-12-25', 'Natale')
    await ok(associa('n26', { tipo: 'famiglia', id: 'r-natale' }))
    await evento(t, 'n27', '2027-12-25', 'Natale')
    // n27 è nella standard, n26 nella personalizzata: non sono edizioni l'una dell'altra.
    expect((await leggi('n27')).ricorrenzaStandard).toBe('natale')
    expect((await edizioni('n27')).edizioni).toEqual([])
    expect((await edizioni('n26')).ricorrenza).toEqual({ tipo: 'famiglia', id: 'r-natale', nome: 'Natale' })
    expect((await edizioni('n27')).ricorrenza).toEqual({ tipo: 'standard', id: 'natale', nome: 'Natale' })
    expect(tutti(t.db, 'SELECT * FROM ricorrenze')).toEqual(prima)
    expect((await ok(t.leggi(`${P}/famiglie/${G}/ricorrenze`))).map((r: { nome: string }) => r.nome)).toEqual(['Natale'])
  })

  it('12. autorizzazioni: associa solo chi modifica l\'evento ed è della Famiglia', async () => {
    await evento(t, 'v26', '2026-12-24', 'Vigilia di Natale')
    await ok(t.scrivi('PUT', `${P}/eventi/v26/condivisioni/${anna.id}`, { permesso: 'lettura' }))
    expect((await associa('v26', null, anna)).statusCode).toBe(403)
    expect(await edizioni('v26', anna)).toMatchObject({ standard: [], suggerita: null, puoAssociare: false })
    expect((await associa('v26', null, carla)).statusCode).toBe(404)
    // In modifica ma fuori dalla Famiglia (condivisione nata prima delle Famiglie): niente ricorrenze.
    esegui(t.db, `INSERT INTO condivisioni_evento (evento_id, utente_id, permesso, partecipa, creato_il) VALUES ('v26', '${carla.id}', 'modifica', 1, 1)`)
    expect((await associa('v26', { tipo: 'standard', id: 'natale' }, carla)).statusCode).toBe(404)
    expect((await leggi('v26')).ricorrenzaStandard).toBe('vigilia-natale')
    // Spostato fra Famiglie la standard resta; reso personale la perde.
    await ok(t.scrivi('PUT', `${P}/eventi/v26/famiglia`, { gruppoId: null }))
    expect((await leggi('v26')).ricorrenzaStandard).toBeNull()
  })
})

describe('compatibilità', () => {
  it('11. migrazione 0015: associazioni esistenti conservate come scelte, nessuna associazione in massa', async () => {
    const cartella = mkdtempSync(join(tmpdir(), 'menuapp-0015-'))
    try {
      const db = apriDatabase(join(cartella, 'menuapp.db'))
      await applicaMigrazioni(db, { cartellaBackup: null, fino: 14 })
      esegui(db, "INSERT INTO ricorrenze (id, gruppo_id, nome, nome_norm, creato_il, aggiornato_il) VALUES ('r', 'gruppo-famiglia', 'Natale', 'natale', 1, 1)")
      const ev = (id: string, occasione: string, ricorrenza: string | null) =>
        esegui(db, "INSERT INTO eventi (id, nome, data, tipo, occasione, adulti, bambini, coefficiente_bambini, creato_il, aggiornato_il, proprietario_id, gruppo_id, ricorrenza_id) VALUES (?, ?, '2025-12-25', 'pranzo', ?, 1, 0, 0.5, 1, 1, 'utente-amministratore', 'gruppo-famiglia', ?)", id, id, occasione, ricorrenza)
      ev('con', 'Natale', 'r')
      ev('senza', 'Natale', null)
      ev('altro', 'Compleanno', null)
      const prima = tutti(db, 'SELECT id, nome, occasione, ricorrenza_id, versione FROM eventi ORDER BY id')
      await applicaMigrazioni(db, { cartellaBackup: null })
      expect(tutti(db, 'SELECT id, nome, occasione, ricorrenza_id, versione FROM eventi ORDER BY id')).toEqual(prima)
      expect(tutti(db, 'SELECT id, ricorrenza_standard, ricorrenza_manuale FROM eventi ORDER BY id')).toEqual([
        { id: 'altro', ricorrenza_standard: null, ricorrenza_manuale: 0 },
        { id: 'con', ricorrenza_standard: null, ricorrenza_manuale: 1 },
        { id: 'senza', ricorrenza_standard: null, ricorrenza_manuale: 0 },
      ])
      expect(tutti(db, 'PRAGMA foreign_key_check')).toEqual([])
      chiudiDatabase(db)
    } finally {
      rmSync(cartella, { recursive: true, force: true })
    }
  })

  it('evento esistente senza ricorrenza: si propone quella dell\'occasione, senza associarla', async () => {
    await evento(t, 'vecchio', '2025-12-25', 'Natale', { ricorrenza: null })
    // Come un evento nato prima della 0015: nessuna scelta registrata.
    esegui(t.db, "UPDATE eventi SET ricorrenza_manuale = 0 WHERE id = 'vecchio'")
    expect(await edizioni('vecchio')).toMatchObject({ ricorrenza: null, suggerita: { id: 'natale' } })
    expect((await leggi('vecchio')).ricorrenzaStandard).toBeNull()
  })

  it('esportazione e ripristino conservano le associazioni standard', async () => {
    await evento(t, 'v26', '2026-12-24', 'Vigilia di Natale')
    const esportazione = corpo(await t.leggi(`${P}/esportazione`))
    await ok(associa('v26', null))
    const v = await ok(t.scrivi('POST', `${P}/ripristino/verifica`, { origine: 'file', contenuto: esportazione }))
    await ok(t.scrivi('POST', `${P}/ripristino/esegui`, { token: v.token, conferma: 'RIPRISTINA' }))
    expect((await leggi('v26')).ricorrenzaStandard).toBe('vigilia-natale')
    expect((await edizioni('v26')).suggerita).toBeNull()
  })
})
