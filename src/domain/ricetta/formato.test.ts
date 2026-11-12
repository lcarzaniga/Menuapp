import { describe, expect, it } from 'vitest'
import { validaRicetta } from '../../contratto/formato-ricetta.ts'
import { aTesto, daTesto, minutiDaTesto, nomeFileRicetta } from './formato.ts'

const SCRITTA = `# Lasagne alla bolognese

Portata: Primi
Porzioni: 6
Preparazione: 1 h 30 min
Cottura: 45 min
Attrezzature: teglia 30×20, frusta
Fonte: nonna Pina

## Ingredienti
- 500 g di lasagne
Per la besciamella:
- 1 l di latte
- noce moscata q.b.

## Procedimento
1. Preparare il ragù.
2. Montare gli strati
e infornare.

## Note
Si prepara anche il giorno prima.
`

describe('formato ricetta v1', () => {
  it('legge la scrittura a mano', () => {
    const r = daTesto(SCRITTA)
    expect(r).toMatchObject({
      nome: 'Lasagne alla bolognese',
      portata: 'Primi',
      porzioniBase: 6,
      tempi: { preparazioneMin: 90, cotturaMin: 45 },
      attrezzature: ['teglia 30×20', 'frusta'],
      fonte: 'nonna Pina',
      ingredienti: ['500 g di lasagne', '1 l di latte', 'noce moscata q.b.'],
      procedimento: ['Preparare il ragù.', 'Montare gli strati e infornare.'],
      note: 'Si prepara anche il giorno prima.',
    })
    expect(validaRicetta(r).ok).toBe(true)
  })

  it('accetta varianti: titolo senza #, sezioni con i due punti, passi separati da righe vuote, «per 4 persone»', () => {
    const r = daTesto('Tiramisù\nper 8 persone\n\nINGREDIENTI\n500 g mascarpone\n4 uova\n\nProcedimento:\nMontare i tuorli.\n\nAlternare savoiardi e crema.\n')
    expect(r).toMatchObject({ nome: 'Tiramisù', porzioniBase: 8, ingredienti: ['500 g mascarpone', '4 uova'], procedimento: ['Montare i tuorli.', 'Alternare savoiardi e crema.'] })
  })

  it('andata e ritorno testo → ricetta → testo → ricetta', () => {
    const r = daTesto(SCRITTA)
    expect(daTesto(aTesto(r))).toEqual(r)
  })

  it('minuti e nomi di file', () => {
    expect(minutiDaTesto('1 ora')).toBe(60)
    expect(minutiDaTesto('90')).toBe(90)
    expect(minutiDaTesto("45'")).toBe(45)
    expect(minutiDaTesto('a piacere')).toBeNull()
    expect(nomeFileRicetta('Tiramisù della nonna!')).toBe('tiramisu-della-nonna.menuapp-ricetta')
  })

  it('validazione: versione futura, troppe foto, formato estraneo', () => {
    const base = { formato: 'menuapp-ricetta', versione: 1, nome: 'X' }
    expect(validaRicetta(base).ok).toBe(true)
    expect(validaRicetta({ ...base, versione: 2 })).toMatchObject({ ok: false, errore: expect.stringMatching(/più recente/) })
    expect(validaRicetta({ ...base, foto: Array.from({ length: 11 }, (_, i) => ({ file: `foto/${i}.jpg` })) })).toMatchObject({ ok: false })
    expect(validaRicetta({ formato: 'altro', versione: 1, nome: 'X' })).toMatchObject({ ok: false, errore: expect.stringMatching(/Menù & Co\./) })
    expect(validaRicetta({ ...base, campoFuturo: 1, ingredienti: [{ testo: '2 uova', nome: 'uova', quantita: 2 }] }).ok).toBe(true)
  })
})
