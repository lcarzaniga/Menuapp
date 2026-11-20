// Contrasti dei colori dell'app (WCAG 2.1): letti da src/styles/index.css, nei due temi. Testi ≥ 4,5:1,
// controlli e testi grandi ≥ 3:1 (SPEC §31.6, restyling 2026).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

function variabili(selettore: string): Record<string, string> {
  const inizio = css.indexOf(`${selettore} {`)
  const blocco = css.slice(inizio, css.indexOf('\n}', inizio))
  return Object.fromEntries([...blocco.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]))
}

const luminanza = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrasto = (a: string, b: string) => {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

/** [testo, fondo, minimo] */
const COPPIE: [string, string, number][] = [
  ['testo', 'sfondo', 4.5],
  ['testo', 'carta', 4.5],
  ['testo', 'tenue', 4.5],
  ['testo-tenue', 'sfondo', 4.5],
  ['testo-tenue', 'carta', 4.5],
  ['testo-tenue', 'tenue', 4.5],
  ['primario-testo', 'primario', 4.5],
  ['primario', 'carta', 4.5],
  ['primario', 'primario-tenue', 4.5],
  ['salvia-testo', 'salvia-tenue', 4.5],
  ['successo', 'successo-tenue', 4.5],
  ['avviso', 'avviso-tenue', 4.5],
  ['pericolo', 'pericolo-tenue', 4.5],
  ['info', 'info-tenue', 4.5],
  // Bordi dei controlli disegnati con il testo secondario (cerchi da spuntare).
  ['testo-tenue', 'carta', 3],
]

describe.each([
  ['chiaro', ':root'],
  ['scuro', '.dark'],
])('contrasti del tema %s', (_, selettore) => {
  const v = variabili(selettore)
  it.each(COPPIE)('%s su %s ≥ %s:1', (testo, fondo, minimo) => {
    expect(v[testo], testo).toBeDefined()
    expect(v[fondo], fondo).toBeDefined()
    expect(contrasto(v[testo]!, v[fondo]!)).toBeGreaterThanOrEqual(minimo)
  })
  it('le superfici del tema scuro sono più chiare dello sfondo (carta, poi tenue)', () => {
    if (selettore !== '.dark') return
    expect(luminanza(v.carta!)).toBeGreaterThan(luminanza(v.sfondo!))
    expect(luminanza(v.tenue!)).toBeGreaterThan(luminanza(v.carta!))
  })
})
