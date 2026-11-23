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

/** Colore a + t × (b − a), come color-mix. */
const mescola = (a: string, b: string, t: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')

/** Tinta (0–360°) di un colore. */
const tinta = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/** [testo, fondo, minimo] */
const COPPIE: [string, string, number][] = [
  ['testo', 'sfondo', 4.5],
  ['testo', 'carta', 4.5],
  ['testo', 'tenue', 4.5],
  ['testo-tenue', 'sfondo', 4.5],
  ['testo-tenue', 'carta', 4.5],
  ['testo-tenue', 'tenue', 4.5],
  // Ottanio: azioni (pulsanti, link), testo e stati attivi sui fondi chiari, pulsante premuto.
  ['primario-testo', 'primario', 4.5],
  ['primario-testo', 'primario-forte', 4.5],
  ['primario', 'sfondo', 4.5],
  ['primario', 'carta', 4.5],
  ['primario', 'tenue', 4.5],
  ['primario', 'primario-tenue', 4.5],
  ['primario-forte', 'primario-tenue', 4.5],
  // Marchio in terracotta (testo grande, ma lo si tiene ai testi normali).
  ['accento-caldo', 'carta', 4.5],
  // Pagina Eventi: conto alla rovescia e scritte dei blocchi data in oro scuro sui fondi oro; numero del
  // giorno in terracotta (testo grande: 3:1 sull'oro intenso del prossimo evento).
  ['oro-forte', 'oro-tenue', 4.5],
  ['oro-forte', 'oro-medio', 4.5],
  ['accento-caldo', 'oro-tenue', 4.5],
  ['accento-caldo', 'oro-medio', 3],
  // Conto alla rovescia delle schede dell'elenco in oro scuro sulla carta (e sul tenue al passaggio del mouse).
  ['oro-forte', 'carta', 4.5],
  ['oro-forte', 'tenue', 4.5],
  // Pulsanti di navigazione della scheda del prossimo evento: ottanio scuro sulla carta.
  ['primario-forte', 'carta', 4.5],
  ['successo', 'successo-tenue', 4.5],
  ['avviso', 'avviso-tenue', 4.5],
  ['pericolo', 'pericolo-tenue', 4.5],
  ['info', 'info-tenue', 4.5],
  // Controlli e icone che portano un'informazione: almeno 3:1 (cerchi da spuntare, focus, stelle in oro,
  // che stanno sulle schede; sul fondo l'oro è solo ornamento).
  ['testo-tenue', 'carta', 3],
  ['anello', 'sfondo', 3],
  ['oro', 'carta', 3],
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
  it('il verde del completato si distingue dall\'ottanio (tinte ad almeno 45°)', () => {
    for (const [a, b] of [['successo', 'primario'], ['successo-tenue', 'primario-tenue']] as const) {
      const d = Math.abs(tinta(v[a]!) - tinta(v[b]!))
      expect(Math.min(d, 360 - d), `${a} / ${b}`).toBeGreaterThanOrEqual(45)
    }
  })
  it('etichette della navigazione leggibili sul quadretto più scuro della tovaglia (utilità «tovaglia»)', () => {
    // Due bande incrociate del colore principale sulla carta, all'intensità di --tovaglia.
    const blocco = css.slice(css.indexOf(`${selettore} {`))
    const t = Number(/--tovaglia:\s*([\d.]+)%/.exec(blocco)![1]) / 100
    const quadretto = mescola(mescola(v.carta!, v.primario!, t), v.primario!, t)
    expect(contrasto(v['testo-tenue']!, quadretto)).toBeGreaterThanOrEqual(4.5)
    expect(contrasto(v['primario-forte']!, quadretto)).toBeGreaterThanOrEqual(4.5)
    expect(contrasto(v.testo!, quadretto)).toBeGreaterThanOrEqual(4.5)
  })
  // Superficie secondaria (--superficie): un token esistente o una mescolanza di due (color-mix).
  const superficie = (() => {
    const blocco = css.slice(css.indexOf(`${selettore} {`), css.indexOf('\n}', css.indexOf(`${selettore} {`)))
    const def = /--superficie:\s*([^;]+);/.exec(blocco)![1]!.trim()
    const mix = /color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, var\(--([\w-]+)\)\)/.exec(def)
    if (mix) return mescola(v[mix[1]!]!, v[mix[3]!]!, 1 - Number(mix[2]) / 100)
    return v[/var\(--([\w-]+)\)/.exec(def)![1]!]!
  })()
  it.each(['testo', 'testo-tenue', 'primario', 'primario-forte', 'oro-forte'])('%s sulla superficie secondaria ≥ 4,5:1', (testo) => {
    expect(contrasto(v[testo]!, superficie)).toBeGreaterThanOrEqual(4.5)
  })
  it('la carta resta la scheda più luminosa: carta, poi superficie secondaria, poi sfondo', () => {
    expect(luminanza(v.carta!)).toBeGreaterThan(luminanza(superficie))
    expect(luminanza(superficie)).toBeGreaterThan(luminanza(v.sfondo!))
  })
  it('le superfici del tema scuro sono più chiare dello sfondo (carta, poi tenue)', () => {
    if (selettore !== '.dark') return
    expect(luminanza(v.carta!)).toBeGreaterThan(luminanza(v.sfondo!))
    expect(luminanza(v.tenue!)).toBeGreaterThan(luminanza(v.carta!))
  })
})
