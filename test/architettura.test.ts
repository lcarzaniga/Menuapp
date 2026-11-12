// Regole di dipendenza fra livelli (SPEC §12.3), verificate sugli import reali.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
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

describe('architettura', () => {
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
