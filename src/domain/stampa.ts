// Designer del menù stampato: modelli, palette, caratteri e predefiniti (SPEC F8).
import { norm } from './testo.ts'

export const MODELLI_STAMPA = ['elegante', 'minimal', 'rustico', 'festivo', 'natale'] as const
export type ModelloStampa = (typeof MODELLI_STAMPA)[number]

export const FORMATI_STAMPA = ['A4', 'A5', 'A5x2'] as const
export type FormatoStampa = (typeof FORMATI_STAMPA)[number]

export const PALETTE_STAMPA = ['bordeaux', 'bosco', 'notte', 'terracotta', 'grafite', 'festa', 'natale'] as const
export type PaletteStampa = (typeof PALETTE_STAMPA)[number]

export const CARATTERI_STAMPA = ['classica', 'garamond', 'moderna', 'calligrafica'] as const
export type CaratteriStampa = (typeof CARATTERI_STAMPA)[number]

export interface OpzioniStampa {
  modello: ModelloStampa
  formato: FormatoStampa
  /** null = nome dell'evento. */
  titolo: string | null
  sottotitolo: string
  mostraData: boolean
  nota: string
  palette: PaletteStampa
  caratteri: CaratteriStampa
  decorazioni: boolean
  nascondiPortateVuote: boolean
  /** Mostra le note delle voci del menù sotto il nome del piatto. */
  mostraNote: boolean
}

export const LIMITI_STAMPA = { titolo: 120, sottotitolo: 160, nota: 600 } as const

export interface DescrizioneModello {
  nome: string
  descrizione: string
  palette: PaletteStampa
  caratteri: CaratteriStampa
}

export const MODELLI: Record<ModelloStampa, DescrizioneModello> = {
  elegante: { nome: 'Elegante', descrizione: 'Simmetrico, cornice sottile, maiuscoletti', palette: 'bordeaux', caratteri: 'classica' },
  minimal: { nome: 'Minimal', descrizione: 'Allineato a sinistra, tanto bianco, linee pulite', palette: 'grafite', caratteri: 'moderna' },
  rustico: { nome: 'Rustico', descrizione: 'Da trattoria: toni caldi, rametti d\'ulivo', palette: 'terracotta', caratteri: 'garamond' },
  festivo: { nome: 'Festivo', descrizione: 'Festoni e portate in risalto, per ricorrenze', palette: 'festa', caratteri: 'classica' },
  natale: { nome: 'Natale', descrizione: 'Agrifoglio e stelle, sobrio e luminoso', palette: 'natale', caratteri: 'calligrafica' },
}

export interface Colori {
  nome: string
  /** Testo principale. */
  inchiostro: string
  /** Titoli delle portate, filetti. */
  accento: string
  /** Ornamenti. */
  secondario: string
  /** Fondi leggeri (stampati solo con «Grafica di sfondo»). */
  tenue: string
}

export const PALETTE: Record<PaletteStampa, Colori> = {
  bordeaux: { nome: 'Bordeaux e oro', inchiostro: '#2b1d1a', accento: '#7a1f2b', secondario: '#b08a47', tenue: '#f7efe6' },
  bosco: { nome: 'Verde bosco', inchiostro: '#1f2a22', accento: '#2f5d46', secondario: '#a8874a', tenue: '#eef3ec' },
  notte: { nome: 'Blu notte', inchiostro: '#1c2333', accento: '#23365e', secondario: '#a88a4e', tenue: '#eef1f7' },
  terracotta: { nome: 'Terracotta', inchiostro: '#3a2a20', accento: '#a5412a', secondario: '#6f7f4f', tenue: '#f8efe2' },
  grafite: { nome: 'Grafite', inchiostro: '#1d1d1f', accento: '#1d1d1f', secondario: '#8a8a8e', tenue: '#f2f2f2' },
  festa: { nome: 'Lampone e sole', inchiostro: '#2a2340', accento: '#c2416b', secondario: '#e0a526', tenue: '#fdf0f3' },
  natale: { nome: 'Rosso e verde', inchiostro: '#22201c', accento: '#a3242e', secondario: '#2e5a3c', tenue: '#f6f1e7' },
}

export const CARATTERI: Record<CaratteriStampa, { nome: string; esempio: string }> = {
  classica: { nome: 'Classica', esempio: 'Fraunces' },
  garamond: { nome: 'Garamond', esempio: 'Cormorant Garamond' },
  moderna: { nome: 'Moderna', esempio: 'Josefin Sans e Inter' },
  calligrafica: { nome: 'Calligrafica', esempio: 'Great Vibes e Garamond' },
}

/** Modello suggerito dall'occasione dell'evento. */
export function modelloPerOccasione(occasione: string, nome = ''): ModelloStampa {
  const t = norm(`${occasione} ${nome}`)
  if (/natal|vigilia|santo stefano|epifania|befana/.test(t)) return 'natale'
  if (/compleann|anniversar|battesim|comunion|cresima|laurea|matrimon|nozze|festa|pasqua/.test(t)) return 'festivo'
  if (/capodanno|san silvestro/.test(t)) return 'elegante'
  return 'elegante'
}

/** Stile iniziale: già gradevole senza toccare nulla. */
export function opzioniPredefinite(evento: { occasione: string; nome: string }): OpzioniStampa {
  const modello = modelloPerOccasione(evento.occasione, evento.nome)
  return {
    modello,
    formato: 'A4',
    titolo: null,
    sottotitolo: '',
    mostraData: true,
    nota: '',
    palette: MODELLI[modello].palette,
    caratteri: MODELLI[modello].caratteri,
    decorazioni: true,
    nascondiPortateVuote: true,
    mostraNote: false,
  }
}

/** Cambio di modello: palette e caratteri passano a quelli coordinati del nuovo modello. */
export function conModello(o: OpzioniStampa, modello: ModelloStampa): OpzioniStampa {
  return { ...o, modello, palette: MODELLI[modello].palette, caratteri: MODELLI[modello].caratteri }
}
