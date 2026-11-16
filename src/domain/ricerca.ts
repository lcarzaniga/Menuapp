// Ricerca delle ricette per nome e ingredienti (SPEC §23). Funzioni pure, usate dal
// ricettario, dalla scelta delle ricette per il menù e dal server.
import { norm } from './testo.ts'

/** Parole che non aiutano a cercare («lasagne al ragù», «pasta con le zucchine»). */
const VUOTE = new Set(['di', 'del', 'della', 'dei', 'delle', 'dello', 'degli', 'al', 'allo', 'alla', 'ai', 'alle', 'agli', 'con', 'e', 'ed', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'in', 'per', 'da', 'a'])

/** Parole di un testo normalizzato («l'olio» → ["l", "olio"]). */
const parole = (testoNorm: string) => testoNorm.split(/[^a-z0-9]+/).filter(Boolean)

/** Termini di ricerca: senza accenti, maiuscole, doppioni e parole vuote. */
export function terminiRicerca(testo: string): string[] {
  return [...new Set(parole(norm(testo)).filter((p) => p.length >= 2 && !VUOTE.has(p)))]
}

/**
 * Una parola corrisponde al termine se comincia con esso («pomod» → «pomodoro») o se ne
 * differisce solo per la vocale finale (singolare e plurale: «pomodori» → «pomodoro», «uova» → «uovo»).
 */
function corrisponde(parola: string, termine: string): boolean {
  if (parola.startsWith(termine)) return true
  return termine.length >= 4 && parola.length === termine.length && parola.slice(0, -1) === termine.slice(0, -1) && /[aeiou]$/.test(parola) && /[aeiou]$/.test(termine)
}

export interface RicettaCercabile {
  nome: string
  /** Nomi degli ingredienti: come scritti nella ricetta, nel catalogo e i loro sinonimi. */
  ingredienti: readonly string[]
}

export type LivelloRisultato = 'nome' | 'ingredienti' | 'parziale'

export interface Risultato<T> {
  ricetta: T
  livello: LivelloRisultato
  /** Termini trovati fra gli ingredienti (per spiegare il risultato). */
  ingredientiTrovati: string[]
  /** Quanti termini corrispondono (per i parziali). */
  corrispondenze: number
  /** Quanti termini sono nel nome. */
  nelNome: number
}

const ALFABETICO = new Intl.Collator('it', { sensitivity: 'base', numeric: true })
const ORDINE: Record<LivelloRisultato, number> = { nome: 0, ingredienti: 1, parziale: 2 }

interface Indice {
  nome: string
  paroleNome: string[]
  /** Per ogni ingrediente, le sue parole normalizzate. */
  ingredienti: string[][]
}
// Le stesse ricette si cercano a ogni tasto: le parole normalizzate si calcolano una volta.
const indici = new WeakMap<RicettaCercabile, Indice>()
function indice(r: RicettaCercabile): Indice {
  let x = indici.get(r)
  if (!x) {
    const nome = norm(r.nome)
    x = { nome, paroleNome: parole(nome), ingredienti: r.ingredienti.map((i) => parole(norm(i))) }
    indici.set(r, x)
  }
  return x
}

/**
 * Ricette che corrispondono al testo, in ordine:
 * 1. tutti i termini nel nome (prima chi comincia con il testo cercato);
 * 2. tutti i termini trovati, almeno uno fra gli ingredienti (nome scritto, catalogo, sinonimi);
 * 3. corrispondenze parziali (alcuni termini), dalle più complete.
 * Dentro ogni gruppo vengono prima le ricette con più termini nel nome.
 * A parità, ordine alfabetico italiano. Con un testo vuoto restituisce un elenco vuoto.
 */
export function cercaRicette<T extends RicettaCercabile>(ricette: readonly T[], testo: string): Risultato<T>[] {
  const termini = terminiRicerca(testo)
  if (termini.length === 0) return []
  const frase = norm(testo)
  const risultati: (Risultato<T> & { inizio: boolean; nomeNorm: string })[] = []
  for (const r of ricette) {
    const x = indice(r)
    const nomeNorm = x.nome
    let nelNome = 0
    let trovati = 0
    const ingredientiTrovati: string[] = []
    for (const t of termini) {
      // Nel nome vale anche una parte di parola, come la ricerca di prima («sagne» → «Lasagne»).
      if (nomeNorm.includes(t) || x.paroleNome.some((p) => corrisponde(p, t))) {
        nelNome++
        trovati++
        continue
      }
      const k = x.ingredienti.findIndex((ps) => ps.some((p) => corrisponde(p, t)))
      if (k !== -1) {
        trovati++
        if (!ingredientiTrovati.includes(r.ingredienti[k]!)) ingredientiTrovati.push(r.ingredienti[k]!)
      }
    }
    if (trovati === 0) continue
    const livello: LivelloRisultato = nelNome === termini.length ? 'nome' : trovati === termini.length ? 'ingredienti' : 'parziale'
    risultati.push({ ricetta: r, livello, ingredientiTrovati, corrispondenze: trovati, nelNome, inizio: nomeNorm.startsWith(frase), nomeNorm })
  }
  return risultati
    .sort(
      (a, b) =>
        ORDINE[a.livello] - ORDINE[b.livello] ||
        Number(b.inizio) - Number(a.inizio) ||
        b.corrispondenze - a.corrispondenze ||
        b.nelNome - a.nelNome ||
        ALFABETICO.compare(a.ricetta.nome, b.ricetta.nome),
    )
    .map(({ inizio: _i, nomeNorm: _n, ...r }) => r)
}
