import { describe, expect, it } from 'vitest'
import { cercaRicette, terminiRicerca } from './ricerca.ts'

const r = (nome: string, ...ingredienti: string[]) => ({ nome, ingredienti })
const RICETTE = [
  r('Pasta al pomodoro', 'spaghetti', 'pomodori pelati', 'basilico', 'olio extravergine'),
  r('Pollo al curry', 'petto di pollo', 'curry', 'latte di cocco'),
  r('Insalata caprese', 'mozzarella', 'pomodoro', 'basilico', 'origano'),
  r('Lasagne alla bolognese', 'lasagne', 'ragù', 'besciamella', 'parmigiano'),
  r('Pomodori ripieni', 'pomodori', 'riso', 'prezzemolo'),
  r('Torta di mele', 'mele', 'uova', 'farina', 'zucchero'),
  r('Frittata', 'uovo', 'parmigiano', 'sale'),
  r('Salsiccia e friarielli', 'salsiccia', 'cime di rapa'),
]
const nomi = (testo: string) => cercaRicette(RICETTE, testo).map((x) => x.ricetta.nome)

describe('ricerca delle ricette (SPEC §23)', () => {
  it('termini senza maiuscole, accenti, doppioni e parole vuote', () => {
    expect(terminiRicerca('  Ragù  della NONNA, ragu ')).toEqual(['ragu', 'nonna'])
    expect(terminiRicerca('al di con')).toEqual([])
  })

  it('cerca nel nome anche con una parte di parola, senza accenti né maiuscole', () => {
    expect(nomi('SAGNE')).toEqual(['Lasagne alla bolognese'])
    expect(nomi('ragu')).toEqual(['Lasagne alla bolognese'])
    expect(nomi('RAGÙ')).toEqual(['Lasagne alla bolognese'])
  })

  it('cerca negli ingredienti e dice quali ha trovato', () => {
    const [x] = cercaRicette(RICETTE, 'cocco')
    expect(x).toMatchObject({ livello: 'ingredienti', ingredientiTrovati: ['latte di cocco'] })
    expect(x!.ricetta.nome).toBe('Pollo al curry')
  })

  it('singolare e plurale, inizio di parola, niente corrispondenze casuali dentro le parole', () => {
    expect(nomi('uova')).toEqual(['Frittata', 'Torta di mele'])
    expect(nomi('sale')).toEqual(['Frittata']) // non «salsiccia»
    expect(nomi('pomod').slice(0, 2)).toEqual(['Pomodori ripieni', 'Pasta al pomodoro'])
  })

  it('ordine: prima il nome, poi tutti i termini fra gli ingredienti, infine i parziali', () => {
    const x = cercaRicette(RICETTE, 'pomodoro basilico')
    // «Pasta al pomodoro» ha «pomodoro» nel nome: prima della caprese.
    expect(x.map((y) => [y.ricetta.nome, y.livello])).toEqual([
      ['Pasta al pomodoro', 'ingredienti'],
      ['Insalata caprese', 'ingredienti'],
      ['Pomodori ripieni', 'parziale'],
    ])
    expect(nomi('pomodoro')).toEqual(['Pasta al pomodoro', 'Pomodori ripieni', 'Insalata caprese'])
    // Fra chi ha tutti i termini, prima chi ne ha qualcuno nel nome.
    expect(nomi('riso pomodori')).toEqual(['Pomodori ripieni', 'Pasta al pomodoro', 'Insalata caprese'])
    // Più ingredienti insieme: chi li ha tutti prima di chi ne ha solo alcuni.
    expect(cercaRicette(RICETTE, 'parmigiano uova besciamella').map((y) => [y.ricetta.nome, y.corrispondenze])).toEqual([
      ['Frittata', 2],
      ['Lasagne alla bolognese', 2],
      ['Torta di mele', 1],
    ])
  })

  it('i sinonimi del catalogo forniti fra gli ingredienti valgono come gli altri nomi', () => {
    expect(nomi('rapini')).toEqual([])
    const conSinonimi = [...RICETTE.slice(0, 7), r('Salsiccia e friarielli', 'salsiccia', 'cime di rapa', 'friarielli', 'rapini')]
    expect(cercaRicette(conSinonimi, 'rapini').map((x) => x.ricetta.nome)).toEqual(['Salsiccia e friarielli'])
  })

  it('prestazioni: 5000 ricette da 15 ingredienti, ricerca ripetuta a ogni tasto', () => {
    const tante = Array.from({ length: 5000 }, (_, i) => r(`Ricetta ${i} con verdure`, ...Array.from({ length: 15 }, (_, k) => `ingrediente ${(i * 7 + k) % 900} di stagione`)))
    let inizio = performance.now()
    cercaRicette(tante, 'pomodoro') // la prima prepara le parole normalizzate
    const prima = performance.now() - inizio
    inizio = performance.now()
    for (const q of ['ingrediente 12', 'verdure ingrediente 5', 'stagione', 'pomodoro']) cercaRicette(tante, q)
    const ms = (performance.now() - inizio) / 4
    console.log(`5000 ricette: prima ricerca ${prima.toFixed(0)} ms, poi ${ms.toFixed(1)} ms per ricerca`)
    expect(prima).toBeLessThan(1500)
    expect(ms).toBeLessThan(100)
  })
})
