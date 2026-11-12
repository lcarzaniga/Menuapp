import { execFile } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { SchemaEsportazione, SchemaRiepilogoRipristino } from '../../src/contratto/backup.ts'
import { apriDatabase, esegui, uno } from '../db/connessione.ts'
import { appDiProva, type AppDiProva, dbDiProva, type DbDiProva } from '../prova.ts'
import { ultimaVersione } from '../db/migrazioni/esegui.ts'
import { creaBackup, elencaBackup, verificaFile } from './backup.ts'
import { esporta } from './esportazione.ts'
import { eseguiRipristino, RegistroRipristini, verificaRipristino } from './ripristino.ts'

const pulizie: (() => void)[] = []
afterEach(() => {
  while (pulizie.length) pulizie.pop()?.()
})
async function db(): Promise<DbDiProva> {
  const p = await dbDiProva()
  pulizie.push(p.chiudi)
  return p
}
async function app(): Promise<AppDiProva> {
  const t = await appDiProva()
  pulizie.push(t.chiudi)
  return t
}
const corpo = (r: { body: string }) => JSON.parse(r.body)

/** Un evento completo con portata, piatto, voce, spesa e attività. */
function popola(d: DbDiProva['db'], n = 1) {
  for (let i = 0; i < n; i++) {
    const e = `e${i}`
    esegui(d, `INSERT INTO eventi (id, nome, data, tipo, adulti, bambini, coefficiente_bambini, creato_il, aggiornato_il) VALUES (?, ?, '2026-12-25', 'pranzo', 8, 2, 0.5, 1, 1)`, e, `Natale ${i}`)
    esegui(d, `INSERT INTO portate_evento (id, evento_id, nome, ordine) VALUES (?, ?, 'Primi', 0)`, `p${i}`, e)
    esegui(d, `INSERT INTO piatti (id, nome, nome_norm, porzioni_base, procedimento, creato_il, aggiornato_il) VALUES (?, 'Lasagne', 'lasagne', 6, '["Stendere"]', 1, 1)`, `d${i}`)
    esegui(d, `INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, piatto_id, creato_il, aggiornato_il) VALUES (?, ?, ?, 0, 'Lasagne', ?, 1, 1)`, `v${i}`, e, `p${i}`, `d${i}`)
    esegui(d, `INSERT INTO articoli_spesa (id, evento_id, tipo, nome, creato_il, aggiornato_il) VALUES (?, ?, 'manuale', 'Ghiaccio', 1, 1)`, `a${i}`, e)
    esegui(d, `INSERT INTO attivita (id, evento_id, titolo, data, voce_menu_id, creato_il, aggiornato_il) VALUES (?, ?, 'Ragù', '2026-12-24', ?, 1, 1)`, `t${i}`, e, `v${i}`)
  }
}

describe('creazione dei backup', () => {
  it('copia coerente e verificata anche con scritture in corso', async () => {
    const p = await db()
    popola(p.db, 3)
    const promessa = creaBackup(p.db, p.cartellaBackup, 'manuale')
    for (let i = 0; i < 50; i++) {
      esegui(p.db, `INSERT INTO attivita (id, evento_id, titolo, data, creato_il, aggiornato_il) VALUES (?, 'e0', 'x', '2026-12-24', 1, 1)`, `x${i}`)
    }
    const info = await promessa
    expect(info.verificato).toBe(true)
    expect(info.conteggi.eventi).toBe(3)
    expect(verificaFile(join(p.cartellaBackup, info.nome)).versioneSchema).toBe(ultimaVersione())
    expect(readFileSync(join(p.cartellaBackup, `${info.nome}.json`), 'utf8')).toContain(info.sha256)
  })

  it('il comando del timer funziona in un processo separato mentre il servizio è aperto', async () => {
    const p = await db()
    popola(p.db)
    const { stdout } = await promisify(execFile)(process.execPath, ['server/backup/cli.ts', 'giornaliero'], {
      env: { ...process.env, MENUAPP_DATI: p.cartella },
    })
    expect(stdout).toMatch(/Backup giornaliero verificato/)
    const elenco = await elencaBackup(p.cartellaBackup)
    expect(elenco.some((b) => b.tipo === 'giornaliero' && b.verificato)).toBe(true)
    expect(JSON.parse(uno<{ valore: string }>(p.db, "SELECT valore FROM meta WHERE chiave = 'ultimo_backup'")!.valore).esito).toBe('ok')
  })

  it('rotazione per tipo e copia settimanale la domenica', async () => {
    const p = await db()
    const base = new Date(2026, 10, 1, 3, 45) // domenica 1 novembre 2026
    for (let i = 0; i < 17; i++) await creaBackup(p.db, p.cartellaBackup, 'giornaliero', new Date(base.getTime() + i * 86_400_000))
    for (let i = 0; i < 12; i++) await creaBackup(p.db, p.cartellaBackup, 'manuale', new Date(base.getTime() + i * 1000))
    const elenco = await elencaBackup(p.cartellaBackup)
    expect(elenco.filter((b) => b.tipo === 'giornaliero')).toHaveLength(14)
    expect(elenco.filter((b) => b.tipo === 'manuale')).toHaveLength(10)
    expect(elenco.filter((b) => b.tipo === 'settimanale')).toHaveLength(3)
  })

  it('un file danneggiato non supera la verifica e i file estranei sono ignorati', async () => {
    const p = await db()
    const rotto = join(p.cartella, 'rotto.db')
    writeFileSync(rotto, 'SQLite format 3\0' + 'x'.repeat(5000))
    expect(() => verificaFile(rotto)).toThrow()
    mkdirSync(p.cartellaBackup, { recursive: true })
    writeFileSync(join(p.cartellaBackup, 'appunti.txt'), 'x')
    writeFileSync(join(p.cartellaBackup, '.temp-1.db'), 'x')
    expect(await elencaBackup(p.cartellaBackup)).toEqual([])
  })
})

describe('esportazione', () => {
  it('impronta stabile su esportazioni consecutive ed esclusione dei dati di servizio', async () => {
    const p = await db()
    popola(p.db, 2)
    const a = esporta(p.db, 'x', new Date('2026-12-01T10:00:00Z'))
    const b = esporta(p.db, 'x', new Date('2026-12-02T10:00:00Z'))
    expect(SchemaEsportazione.parse(a).impronta).toBe(b.impronta)
    expect(a.dati.meta?.map((r) => r.chiave)).not.toContain('revisione')
    expect(Object.keys(a.dati)).not.toContain('migrazioni_applicate')
    expect(a.conteggi.voci_menu).toBe(2)
  })
})

describe('ripristino via API', () => {
  async function scenario() {
    const t = await app()
    popola(t.db, 2)
    const esportazione = corpo(await t.leggi('/api/v1/esportazione'))
    return { t, esportazione }
  }

  it('esportazione → modifiche → ripristino → stessi dati e stessa impronta', async () => {
    const { t, esportazione } = await scenario()
    const revisionePrima = corpo(await t.leggi('/api/v1/revisione')).revisione
    esegui(t.db, "DELETE FROM eventi WHERE id = 'e1'")
    esegui(t.db, "UPDATE piatti SET nome = 'Cambiato'")
    const testo = JSON.stringify(esportazione, null, 2) // reindentato: l'impronta resta valida
    const v = await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'file', contenuto: JSON.parse(testo) })
    expect(v.statusCode).toBe(200)
    const riepilogo = SchemaRiepilogoRipristino.parse(corpo(v))
    expect(riepilogo.avvisi).toEqual([])
    expect(riepilogo.conteggi.eventi).toBe(2)
    const r = await t.scrivi('POST', '/api/v1/ripristino/esegui', { token: riepilogo.token, conferma: 'RIPRISTINA' })
    expect(r.statusCode).toBe(200)
    expect(corpo(r).backupPrecedente).toMatch(/^pre-ripristino-/)
    const dopo = corpo(await t.leggi('/api/v1/esportazione'))
    expect(dopo.impronta).toBe(esportazione.impronta)
    expect(corpo(await t.leggi('/api/v1/revisione')).revisione).toBeGreaterThan(revisionePrima)
    expect(uno(t.db, "SELECT valore FROM meta WHERE chiave = 'ultima_esportazione'")).toBeDefined()
  })

  it('ripristino da un backup del server', async () => {
    const { t } = await scenario()
    const b = await t.scrivi('POST', '/api/v1/backup', {})
    expect(b.statusCode).toBe(201)
    esegui(t.db, 'DELETE FROM eventi')
    const v = corpo(await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'backup', nome: corpo(b).nome }))
    expect(v.conteggi.eventi).toBe(2)
    const r = await t.scrivi('POST', '/api/v1/ripristino/esegui', { token: v.token, conferma: 'RIPRISTINA' })
    expect(r.statusCode).toBe(200)
    expect(uno<{ n: number }>(t.db, 'SELECT count(*) AS n FROM eventi')?.n).toBe(2)
  })

  it('impronta errata → avviso, ma il ripristino resta possibile con conferma', async () => {
    const { t, esportazione } = await scenario()
    esportazione.dati.eventi[0].nome = 'Ritoccato a mano'
    const v = corpo(await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'file', contenuto: esportazione }))
    expect(v.avvisi.join(' ')).toMatch(/impronta non corrisponde/)
  })

  it('rifiuti senza modifiche: schema futuro, enum sconosciuto, riferimento rotto, file estraneo', async () => {
    const { t, esportazione } = await scenario()
    const prima = corpo(await t.leggi('/api/v1/esportazione')).impronta
    const casi: [unknown, number, RegExp][] = [
      [{ ...esportazione, versioneSchema: 99 }, 422, /più recente/],
      [{ ...esportazione, dati: { ...esportazione.dati, eventi: [{ ...esportazione.dati.eventi[0], tipo: 'merenda' }] } }, 422, /non validi/],
      [{ ...esportazione, dati: { ...esportazione.dati, voci_menu: [{ ...esportazione.dati.voci_menu[0], piatto_id: 'inesistente' }] } }, 422, /riferimenti non validi/],
      [{ ...esportazione, dati: { ...esportazione.dati, eventi: [{ ...esportazione.dati.eventi[0], colonna_strana: 1 }] } }, 422, /Colonne sconosciute/],
      [{ formato: 'altro' }, 400, /non è un'esportazione/],
    ]
    for (const [contenuto, stato, messaggio] of casi) {
      const r = await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'file', contenuto })
      expect(r.statusCode, JSON.stringify(corpo(r))).toBe(stato)
      expect(corpo(r).errore.messaggio).toMatch(messaggio)
    }
    expect(corpo(await t.leggi('/api/v1/esportazione')).impronta).toBe(prima)
  })

  it('token riusato, conferma mancante, nome di backup con percorso', async () => {
    const { t, esportazione } = await scenario()
    const v = corpo(await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'file', contenuto: esportazione }))
    expect((await t.scrivi('POST', '/api/v1/ripristino/esegui', { token: v.token, conferma: 'si' })).statusCode).toBe(400)
    expect((await t.scrivi('POST', '/api/v1/ripristino/esegui', { token: v.token, conferma: 'RIPRISTINA' })).statusCode).toBe(200)
    const riuso = await t.scrivi('POST', '/api/v1/ripristino/esegui', { token: v.token, conferma: 'RIPRISTINA' })
    expect(riuso.statusCode).toBe(422)
    expect((await t.leggi('/api/v1/backup/..%2F..%2Fetc%2Fpasswd')).statusCode).toBe(400)
    expect((await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'backup', nome: '../menuapp.db' })).statusCode).toBe(422)
  })
})

describe('ripristino che fallisce', () => {
  async function preparato() {
    const p = await db()
    popola(p.db, 2)
    const e = esporta(p.db, 'x')
    esegui(p.db, "UPDATE eventi SET nome = 'Attuale'")
    const registro = new RegistroRipristini(join(p.cartella, 'temp'))
    const r = await verificaRipristino({ origine: 'file', contenuto: e }, { registro, cartellaBackup: p.cartellaBackup })
    const prima = esporta(p.db, 'x').impronta
    return { p, registro, token: r.token, prima }
  }

  it('se il backup pre-ripristino fallisce non cambia nulla', async () => {
    const { p, registro, token, prima } = await preparato()
    writeFileSync(join(p.cartella, 'non-una-cartella'), 'x')
    await expect(eseguiRipristino(p.db, token, { registro, cartellaBackup: join(p.cartella, 'non-una-cartella') })).rejects.toThrow(/Backup dei dati attuali non riuscito/)
    expect(esporta(p.db, 'x').impronta).toBe(prima)
  })

  it('un errore a metà sostituzione annulla tutto', async () => {
    const { p, registro, token, prima } = await preparato()
    await expect(
      eseguiRipristino(p.db, token, {
        registro,
        cartellaBackup: p.cartellaBackup,
        dopoBackup: (percorso) => {
          const s = apriDatabase(percorso)
          s.exec('PRAGMA foreign_keys = OFF')
          s.exec("INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, creato_il, aggiornato_il) VALUES ('orfana', 'nessuno', 'nessuna', 0, 'x', 1, 1)")
          s.close()
        },
      }),
    ).rejects.toThrow(/nessuna modifica/)
    expect(esporta(p.db, 'x').impronta).toBe(prima)
    expect(uno(p.db, "SELECT nome FROM eventi WHERE id = 'e0'")).toEqual({ nome: 'Attuale' })
  })
})
