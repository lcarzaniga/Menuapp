import { afterEach, describe, expect, it } from 'vitest'
import { norm } from '../../../src/domain/testo.ts'
import { dbDiProva, type DbDiProva } from '../../prova.ts'
import { esegui, tutti, uno } from '../connessione.ts'
import { REPARTI_INIZIALI } from './reparti.ts'
import { seedCatalogo, vociCatalogo } from './catalogo.ts'

let p: DbDiProva | undefined
afterEach(() => p?.chiudi())

describe('catalogo iniziale (SPEC §7.5)', () => {
  it('200–250 ingredienti, tutti i reparti coperti, nomi e sinonimi senza conflitti', () => {
    const voci = vociCatalogo()
    expect(voci.length).toBeGreaterThanOrEqual(200)
    expect(voci.length).toBeLessThanOrEqual(250)
    const reparti = new Set(REPARTI_INIZIALI.map((r) => r.id))
    for (const v of voci) expect(reparti, v.nome).toContain(v.repartoId)
    for (const r of REPARTI_INIZIALI.filter((r) => r.id !== 'rep-altro')) {
      expect(voci.filter((v) => v.repartoId === r.id).length, r.nome).toBeGreaterThanOrEqual(5)
    }
    const visti = new Map<string, string>()
    for (const v of voci) {
      for (const n of [v.nome, ...v.sinonimi]) {
        const k = norm(n)
        expect(visti.get(k), `«${n}» (${v.nome}) già usato da ${visti.get(k)}`).toBeUndefined()
        visti.set(k, v.nome)
      }
    }
  })

  it('caricato dal seed, idempotente, rispetta le modifiche dell\'utente', async () => {
    p = await dbDiProva()
    const n = uno<{ n: number }>(p.db, 'SELECT count(*) AS n FROM ingredienti')!.n
    expect(n).toBe(vociCatalogo().length)
    esegui(p.db, "UPDATE ingredienti SET nome = 'Burro di malga', nome_norm = 'burro di malga', versione = 2 WHERE id = 'ing-burro'")
    esegui(p.db, "DELETE FROM meta WHERE chiave = 'seed_catalogo'")
    expect(seedCatalogo(p.db)).toBe(true)
    expect(uno<{ n: number }>(p.db, 'SELECT count(*) AS n FROM ingredienti')!.n).toBe(n)
    expect(uno(p.db, "SELECT nome FROM ingredienti WHERE id = 'ing-burro'")).toEqual({ nome: 'Burro di malga' })
    expect(seedCatalogo(p.db)).toBe(false)
    expect(tutti(p.db, "SELECT scalatura_abituale FROM ingredienti WHERE id = 'ing-alloro'")).toEqual([{ scalatura_abituale: 'fissa' }])
  })
})
