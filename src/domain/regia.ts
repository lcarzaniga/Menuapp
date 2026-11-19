// Regia della cucina (SPEC §38, piano di evoluzione fase 4): solo ordinamento, raggruppamento e
// informazioni dai dati affidabili (attività del piano, tempi e testo delle ricette). Nessuna
// pianificazione automatica né gestione delle risorse.
import { aggiungiGiorni, sottraiMinuti, type DataISO, type Ora } from './tempo.ts'

export type Attrezzatura = 'forno' | 'fornelli' | 'frigo'
export const ATTREZZATURE: { id: Attrezzatura; nome: string }[] = [
  { id: 'forno', nome: 'Forno' },
  { id: 'fornelli', nome: 'Fornelli' },
  { id: 'frigo', nome: 'Frigo' },
]

// Parole comuni nelle ricette (attrezzature e procedimento): è un'indicazione, non un dato certo (D10).
const PAROLE: Record<Attrezzatura, RegExp> = {
  forno: /\b(forno|infornare|inforna|teglia|teglie|pirofila|gratinare|gratin)\b/i,
  fornelli: /\b(fornell\w*|pentol\w*|padell\w*|tegam\w*|casseruol\w*|wok|bollire|rosolare|soffrigger\w*|friggere|saltare in padella|fiamma)\b/i,
  frigo: /\b(frigo\w*|frigorifero|freezer|congelatore|abbattitore|raffreddare in frigo)\b/i,
}

/** Attrezzature che la ricetta nomina, nell'ordine di ATTREZZATURE. */
export function attrezzatureRicetta(attrezzature: string[], procedimento: string[]): Attrezzatura[] {
  const testo = [...attrezzature, ...procedimento].join(' \n ')
  return ATTREZZATURE.map((a) => a.id).filter((a) => PAROLE[a].test(testo))
}

interface AttivitaRegia {
  data: DataISO
  ora: Ora | null
  stato: 'da_fare' | 'fatto'
}

export interface FasiRegia<T> {
  /** Da fare con il giorno passato, o di oggi con l'ora passata. */
  inRitardo: T[]
  /** Di oggi: senza ora, o con l'ora entro la prossima `finestra` di minuti. */
  adesso: T[]
  /** Le altre da fare, in ordine: si possono anche anticipare spuntandole prima. */
  piuTardi: T[]
  fatte: T[]
}

const chiave = (a: AttivitaRegia) => `${a.data} ${a.ora ?? '00:00'}`

/** «data ora» dopo `minuti` (anche oltre la mezzanotte), confrontabile come testo. */
function piuMinuti(data: DataISO, ora: Ora, minuti: number): string {
  const [h, m] = ora.split(':').map(Number) as [number, number]
  const totale = h * 60 + m + minuti
  const giorni = Math.floor(totale / 1440)
  const resto = totale - giorni * 1440
  return `${aggiungiGiorni(data, giorni)} ${String(Math.floor(resto / 60)).padStart(2, '0')}:${String(resto % 60).padStart(2, '0')}`
}

/** Attività divise per fase rispetto al momento `adesso` (ora italiana), ognuna in ordine di tempo. */
export function fasiRegia<T extends AttivitaRegia>(attivita: T[], adesso: { data: DataISO; ora: Ora }, finestra = 60): FasiRegia<T> {
  const ordinate = [...attivita].sort((a, b) => chiave(a).localeCompare(chiave(b)))
  const limite = piuMinuti(adesso.data, adesso.ora, finestra)
  const fasi: FasiRegia<T> = { inRitardo: [], adesso: [], piuTardi: [], fatte: [] }
  for (const a of ordinate) {
    if (a.stato === 'fatto') fasi.fatte.push(a)
    else if (a.data < adesso.data || (a.data === adesso.data && a.ora !== null && a.ora < adesso.ora)) fasi.inRitardo.push(a)
    else if (a.data === adesso.data && (a.ora === null || `${a.data} ${a.ora}` <= limite)) fasi.adesso.push(a)
    else fasi.piuTardi.push(a)
  }
  return fasi
}

/** Minuti totali della ricetta (preparazione, cottura, riposo) se ce n'è almeno uno. */
export function minutiRicetta(t: { preparazione: number | null; cottura: number | null; riposo: number | null }): number | null {
  const parti = [t.preparazione, t.cottura, t.riposo].filter((x): x is number => x !== null)
  return parti.length ? parti.reduce((a, b) => a + b, 0) : null
}

/**
 * Ora a cui iniziare per essere pronti all'ora del servizio, arrotondata al quarto d'ora prima:
 * solo un suggerimento da rivedere (D11). Null se manca un dato o si dovrebbe iniziare il giorno prima.
 */
export function oraInizioSuggerita(data: DataISO, oraServizio: Ora | null, minuti: number | null): Ora | null {
  if (!oraServizio || minuti === null) return null
  const inizio = sottraiMinuti(data, oraServizio, minuti)
  if (inizio.data !== data) return null
  const [h, m] = inizio.ora.split(':').map(Number) as [number, number]
  return `${String(h).padStart(2, '0')}:${String(m - (m % 15)).padStart(2, '0')}`
}
