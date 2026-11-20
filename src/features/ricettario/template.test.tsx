// Template Markdown della ricetta (Ricettario → Importa): il file scaricato è accettato dal parser e
// diventa una ricetta valida per l'API, così com'è.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SchemaNuovoPiatto } from '@/contratto/ricettario.ts'
import { indicizzaCatalogo } from '@/domain/parser/analizza.ts'
import { NOME_TEMPLATE_RICETTA, TEMPLATE_RICETTA } from '@/domain/ricetta/formato.ts'
import { ScaricaTemplate, URL_TEMPLATE_RICETTA } from './ImportaRicetta'
import { daTestoLibero, ingredientiDa, nuovoPiatto } from './importazione'

/** Il contenuto del file che il browser salva dal collegamento. */
function scaricato(href: string): string {
  const [intestazione, dati] = href.split(',', 2) as [string, string]
  expect(intestazione).toBe('data:text/markdown;charset=utf-8')
  return decodeURIComponent(dati)
}

describe('template Markdown della ricetta', () => {
  it('collegamento «Scarica template .md» con nome del file e indicazione', () => {
    const { container, getByText } = render(<ScaricaTemplate />)
    const a = container.querySelector('a')!
    expect(a.textContent).toContain('Scarica template .md')
    expect(a.getAttribute('download')).toBe(NOME_TEMPLATE_RICETTA)
    expect(NOME_TEMPLATE_RICETTA).toBe('ricetta-template.md')
    expect(scaricato(a.getAttribute('href')!)).toBe(TEMPLATE_RICETTA)
    expect(getByText('Compila il modello e importalo qui')).toBeTruthy()
  })

  it('il file scaricato è accettato dal parser con tutti i campi', () => {
    const { ricetta, avvisi } = daTestoLibero(scaricato(URL_TEMPLATE_RICETTA))
    expect(avvisi).toEqual([])
    expect(ricetta).toMatchObject({
      nome: 'Nome della ricetta',
      portata: 'Primi',
      porzioniBase: 4,
      tempi: { preparazioneMin: 20, cotturaMin: 15, riposoMin: 10 },
      attrezzature: ['pentola', 'padella'],
      fonte: 'nonna Maria',
      ingredienti: ['320 g di spaghetti', '2 spicchi di aglio', "olio extravergine d'oliva q.b.", 'sale q.b.'],
      procedimento: ['Descrivi il primo passaggio.', 'Descrivi il secondo passaggio.', "Descrivi l'ultimo passaggio e come servire."],
      note: 'Consigli, varianti e come conservarla.',
    })
  })

  it('così com\'è diventa una ricetta valida per l\'API (nessuna trasformazione)', () => {
    const { ricetta } = daTestoLibero(TEMPLATE_RICETTA)
    const piatto = nuovoPiatto('p1', ricetta.nome, ricetta, ingredientiDa(ricetta, indicizzaCatalogo([])))
    expect(SchemaNuovoPiatto.safeParse(piatto).success).toBe(true)
    expect(piatto.ingredienti.map((i) => i.quantita)).toEqual([320, 2, null, null])
  })

  it('compilato con altri valori, si importa allo stesso modo', () => {
    const compilato = TEMPLATE_RICETTA.replace('Nome della ricetta', 'Tiramisù della nonna').replace('Porzioni: 4', 'Porzioni: 8').replace('- 320 g di spaghetti', '- 500 g di mascarpone')
    expect(daTestoLibero(compilato).ricetta).toMatchObject({ nome: 'Tiramisù della nonna', porzioniBase: 8, ingredienti: expect.arrayContaining(['500 g di mascarpone']) })
  })
})
