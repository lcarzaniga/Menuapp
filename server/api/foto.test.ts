import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validaRicetta } from '../../src/contratto/formato-ricetta.ts'
import { appDiProva, type AppDiProva, ORIGINE_PROVA } from '../prova.ts'

let t: AppDiProva
beforeEach(async () => {
  t = await appDiProva()
  await t.scrivi('POST', '/api/v1/piatti', { id: 'p', nome: 'Tiramisù', porzioniBase: 8, ingredienti: [] })
})
afterEach(() => t.chiudi())
const corpo = (r: { body: string }) => JSON.parse(r.body)

/** JPEG minimo valido per il controllo dei primi byte. */
const jpeg = (n = 1) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, n), Buffer.from([0xff, 0xd9])])
const carica = (id: string, dati: Buffer, tipo = 'image/jpeg', extra = '') =>
  t.inietta({ method: 'POST', url: `/api/v1/piatti/p/foto?id=${id}${extra}`, headers: { origin: ORIGINE_PROVA, 'content-type': tipo }, payload: dati })

describe('foto dei piatti', () => {
  it('caricamento, lettura, prima foto principale, cambio di principale', async () => {
    const a = await carica('f1', jpeg(1), 'image/jpeg', '&didascalia=Teglia')
    expect(a.statusCode, a.body).toBe(201)
    expect(corpo(a)).toMatchObject({ principale: true, didascalia: 'Teglia', tipo: 'image/jpeg' })
    await carica('f2', jpeg(2))
    const letta = await t.leggi('/api/v1/foto/f1')
    expect(letta.headers['content-type']).toBe('image/jpeg')
    expect(Buffer.from(letta.rawPayload).equals(jpeg(1))).toBe(true)
    const f2 = corpo(await t.leggi('/api/v1/piatti/p')).foto.find((f: { id: string }) => f.id === 'f2')
    await t.scrivi('PUT', '/api/v1/foto/f2', { didascalia: 'Fetta', principale: true, versione: f2.versione })
    const foto = corpo(await t.leggi('/api/v1/piatti/p')).foto
    expect(foto.map((f: { id: string; principale: boolean }) => [f.id, f.principale])).toEqual([['f2', true], ['f1', false]])
    expect(corpo(await t.leggi('/api/v1/piatti')).find((x: { id: string }) => x.id === 'p').fotoPrincipale).toBe('f2')
  })

  it('rifiuta tipi falsi, JSON al posto del file e l\'undicesima foto', async () => {
    expect((await carica('x', Buffer.from('non sono una foto'))).statusCode).toBe(400)
    expect((await carica('x', jpeg(), 'image/gif')).statusCode).toBe(415)
    for (let i = 0; i < 10; i++) expect((await carica(`f${i}`, jpeg(i))).statusCode).toBe(201)
    const r = await carica('f10', jpeg(10))
    expect(r.statusCode).toBe(422)
    expect(corpo(r).errore.messaggio).toMatch(/10 foto/)
  })

  it('eliminazione: riga e file', async () => {
    await carica('f1', jpeg())
    const percorso = join(t.cartella, 'foto', 'f1.jpg')
    expect(existsSync(percorso)).toBe(true)
    expect((await t.scrivi('DELETE', '/api/v1/foto/f1?versione=1')).statusCode).toBe(204)
    expect(existsSync(percorso)).toBe(false)
    expect((await t.leggi('/api/v1/foto/f1')).statusCode).toBe(404)
  })

  it('esportazione della ricetta nel formato v1 con le foto', async () => {
    await carica('f1', jpeg(1), 'image/jpeg', '&didascalia=Teglia')
    const r = await t.leggi('/api/v1/piatti/p/esporta')
    expect(r.headers['content-disposition']).toContain('tiramisu.menuapp-ricetta')
    const zip = unzipSync(new Uint8Array(r.rawPayload))
    const ricetta = JSON.parse(strFromU8(zip['ricetta.json']!))
    expect(validaRicetta(ricetta).ok).toBe(true)
    expect(ricetta.foto).toEqual([{ file: 'foto/1.jpg', didascalia: 'Teglia', principale: true }])
    expect(Buffer.from(zip['foto/1.jpg']!).equals(jpeg(1))).toBe(true)
  })

  it('backup con le foto e recupero dopo il ripristino', async () => {
    await carica('f1', jpeg(1))
    const b = corpo(await t.scrivi('POST', '/api/v1/backup', {}))
    expect(existsSync(join(t.cartellaBackup, 'foto', 'f1.jpg'))).toBe(true)
    rmSync(join(t.cartella, 'foto', 'f1.jpg'))
    const v = corpo(await t.scrivi('POST', '/api/v1/ripristino/verifica', { origine: 'backup', nome: b.nome }))
    const e = corpo(await t.scrivi('POST', '/api/v1/ripristino/esegui', { token: v.token, conferma: 'RIPRISTINA' }))
    expect(e.fotoMancanti).toEqual([])
    expect(existsSync(join(t.cartella, 'foto', 'f1.jpg'))).toBe(true)
  })

  it('esportazione ZIP con le foto e file rimesso dopo il ripristino', async () => {
    await carica('f1', jpeg(1))
    const zip = unzipSync(new Uint8Array((await t.leggi('/api/v1/esportazione?foto=1')).rawPayload))
    expect(Object.keys(zip).sort()).toEqual(['esportazione.json', 'foto/f1.jpg'])
    rmSync(join(t.cartella, 'foto', 'f1.jpg'))
    const sbagliato = await t.inietta({ method: 'PUT', url: '/api/v1/foto/f1/file', headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: jpeg(9) })
    expect(sbagliato.statusCode).toBe(400)
    const giusto = await t.inietta({ method: 'PUT', url: '/api/v1/foto/f1/file', headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: Buffer.from(zip['foto/f1.jpg']!) })
    expect(giusto.statusCode).toBe(204)
  })

  it('le immagini non sono accettate su altre rotte', async () => {
    const r = await t.inietta({ method: 'PUT', url: '/api/v1/impostazioni', headers: { origin: ORIGINE_PROVA, 'content-type': 'image/jpeg' }, payload: jpeg() })
    expect(r.statusCode).toBe(415)
  })
})
