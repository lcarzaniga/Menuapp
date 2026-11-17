// Edizioni di un evento (SPEC §25): nome e data proposti duplicando.

/** «Natale 2026» → «Natale 2027» quando la data passa all'anno dopo. */
export function nomeEdizione(nome: string, dataOrigine: string, dataNuova: string): string {
  const da = dataOrigine.slice(0, 4)
  const a = dataNuova.slice(0, 4)
  return da !== a && nome.includes(da) ? nome.replaceAll(da, a) : nome
}

/** Lo stesso giorno l'anno dopo (il 29 febbraio diventa il 28). */
export const annoDopo = (data: string) => `${Number(data.slice(0, 4)) + 1}${data.slice(4) === '-02-29' ? '-02-28' : data.slice(4)}`
