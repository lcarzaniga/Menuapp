// Regole di dipendenza fra livelli (SPEC §12.3), verificate sugli import reali.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RADICE = join(import.meta.dirname, '..')

function file(cartella: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(join(RADICE, cartella))) {
    const p = join(cartella, nome)
    if (statSync(join(RADICE, p)).isDirectory()) out.push(...file(p))
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) out.push(p)
  }
  return out
}

function importDi(percorso: string): string[] {
  const testo = readFileSync(join(RADICE, percorso), 'utf8')
  return [...testo.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => (m[1] ?? m[2])!)
}

function violazioni(cartella: string, vietati: RegExp[]): string[] {
  return file(cartella).flatMap((f) =>
    importDi(f)
      .filter((i) => vietati.some((v) => v.test(i)))
      .map((i) => `${relative(RADICE, join(RADICE, f))} importa ${i}`),
  )
}

/** Moduli raggiunti da `inizio` con import di valori (gli `import type` spariscono nel pacchetto). */
function grafoValori(inizio: string): Map<string, string[]> {
  const visti = new Map<string, string[]>()
  const coda = [inizio]
  while (coda.length) {
    const f = coda.pop()!
    if (visti.has(f)) continue
    const testo = readFileSync(join(RADICE, f), 'utf8')
    const imp = [...testo.matchAll(/^(?:import|export)\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]!)
    visti.set(f, imp)
    for (const i of imp) if (i.startsWith('.') && /\.tsx?$/.test(i)) coda.push(relative(RADICE, resolve(RADICE, dirname(f), i)))
  }
  return visti
}

describe('architettura', () => {
  it('il Worker di Cloudflare non carica moduli che lì non esistono (SPEC §32)', () => {
    const vietati = [/^node:(fs|fs\/promises|sqlite|os|child_process|net|http)$/, /^fastify$/, /^@fastify\//]
    const errori = [...grafoValori('cloudflare/worker.ts')].flatMap(([f, imp]) => imp.filter((i) => vietati.some((v) => v.test(i))).map((i) => `${f} importa ${i}`))
    expect(errori).toEqual([])
  })
  it('il Worker include tutte le migrazioni del server', () => {
    const sql = readdirSync(join(RADICE, 'server/db/migrazioni')).filter((f) => /^\d{4}_.*\.sql$/.test(f))
    const elenco = readFileSync(join(RADICE, 'cloudflare/migrazioni.ts'), 'utf8')
    expect(sql.filter((f) => !elenco.includes(`'../server/db/migrazioni/${f}'`))).toEqual([])
  })

  it('il dominio è puro: niente React, Fastify, SQLite, Node, rete', () => {
    expect(violazioni('src/domain', [/^react/, /fastify/, /^node:/, /zod/, /\.\.\/(api|app|features|components|contratto|connessione)/, /server\//])).toEqual([])
  })
  it('il contratto dipende solo da zod e dal dominio', () => {
    expect(violazioni('src/contratto', [/^react/, /fastify/, /^node:/, /server\//, /\.\.\/(api|app|features|components|connessione)/])).toEqual([])
  })
  it('il frontend non importa codice del server né moduli di Node', () => {
    for (const c of ['src/app', 'src/api', 'src/features', 'src/components', 'src/connessione', 'src/pwa']) {
      expect(violazioni(c, [/server\//, /^node:/, /fastify/])).toEqual([])
    }
  })
  it('le rotte non scrivono SQL: passano dai servizi', () => {
    const sql = file('server/api').filter((f) => /\b(SELECT|INSERT|UPDATE|DELETE)\s+(\*|FROM|INTO|\w+\s+SET)/.test(readFileSync(join(RADICE, f), 'utf8')))
    expect(sql).toEqual([])
  })
  it('il server non importa il frontend', () => {
    expect(violazioni('server', [/src\/(app|api|features|components|connessione|pwa)\//, /^react/])).toEqual([])
  })
})
