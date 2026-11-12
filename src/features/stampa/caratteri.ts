// Caratteri del menù stampato. Quelli in più si caricano solo qui (sottoinsieme latino),
// così l'avvio dell'app resta leggero.
import cormorantCorsivo from '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2?url'
import cormorant from '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2?url'
import josefin from '@fontsource-variable/josefin-sans/files/josefin-sans-latin-wght-normal.woff2?url'
import greatVibes from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url'
import type { CaratteriStampa } from '@/domain/stampa.ts'

interface Famiglie {
  titoli: string
  testo: string
  etichette: string
  /** Correzione della grandezza apparente del testo (Cormorant è piccolo, Inter grande). */
  fattoreTesto: number
  fattoreTitoli: number
  /** Le calligrafie non si scrivono in maiuscolo. */
  titoliCorsivi: boolean
}

const FRAUNCES = "'Fraunces Variable', Georgia, serif"
const CORMORANT = "'Menu Cormorant', 'Cormorant Garamond', Georgia, serif"
const JOSEFIN = "'Menu Josefin', 'Inter Variable', system-ui, sans-serif"
const INTER = "'Inter Variable', system-ui, sans-serif"
const GREAT_VIBES = "'Menu Great Vibes', 'Menu Cormorant', cursive"

export const FAMIGLIE: Record<CaratteriStampa, Famiglie> = {
  classica: { titoli: FRAUNCES, testo: FRAUNCES, etichette: FRAUNCES, fattoreTesto: 1, fattoreTitoli: 1, titoliCorsivi: false },
  garamond: { titoli: CORMORANT, testo: CORMORANT, etichette: CORMORANT, fattoreTesto: 1.1, fattoreTitoli: 1.08, titoliCorsivi: false },
  moderna: { titoli: JOSEFIN, testo: INTER, etichette: JOSEFIN, fattoreTesto: 0.92, fattoreTitoli: 1, titoliCorsivi: false },
  calligrafica: { titoli: GREAT_VIBES, testo: CORMORANT, etichette: CORMORANT, fattoreTesto: 1.1, fattoreTitoli: 1.3, titoliCorsivi: true },
}

const FILE: { famiglia: string; url: string; descrittori: FontFaceDescriptors }[] = [
  { famiglia: 'Menu Cormorant', url: cormorant, descrittori: { weight: '300 700', style: 'normal' } },
  { famiglia: 'Menu Cormorant', url: cormorantCorsivo, descrittori: { weight: '300 700', style: 'italic' } },
  { famiglia: 'Menu Josefin', url: josefin, descrittori: { weight: '100 700', style: 'normal' } },
  { famiglia: 'Menu Great Vibes', url: greatVibes, descrittori: { weight: '400', style: 'normal' } },
]

let registrati = false
function registra() {
  if (registrati || typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return
  registrati = true
  for (const f of FILE) document.fonts.add(new FontFace(f.famiglia, `url(${f.url}) format('woff2')`, f.descrittori))
}

const NOMI: Record<CaratteriStampa, string[]> = {
  classica: ['Fraunces Variable'],
  garamond: ['Menu Cormorant'],
  moderna: ['Menu Josefin', 'Inter Variable'],
  calligrafica: ['Menu Great Vibes', 'Menu Cormorant'],
}

/** Carica i caratteri di una combinazione; si risolve anche se il caricamento fallisce. */
export async function caricaCaratteri(c: CaratteriStampa): Promise<void> {
  registra()
  if (typeof document === 'undefined' || !document.fonts?.load) return
  await Promise.all(
    NOMI[c].flatMap((n) => [document.fonts.load(`400 16px '${n}'`), document.fonts.load(`italic 400 16px '${n}'`), document.fonts.load(`600 16px '${n}'`)]),
  ).catch(() => undefined)
}

/** Tutte le combinazioni (per le miniature). */
export const caricaTuttiICaratteri = () => Promise.all(Object.keys(NOMI).map((c) => caricaCaratteri(c as CaratteriStampa)))
