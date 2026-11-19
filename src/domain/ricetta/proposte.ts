// Proposte di modifica alle ricette e cronologia (SPEC §41): logica pura condivisa da server e
// interfaccia. Una proposta è un elenco di modifiche singole (un campo, o un ingrediente, o una
// foto), ognuna approvabile da sola; il contenuto ufficiale non cambia finché il proprietario non
// decide. I conflitti non si memorizzano: si ricalcolano confrontando il valore di quando la
// proposta è nata con quello ufficiale di adesso.
import type { IngredientePiatto } from '../tipi.ts'

/** Il contenuto della ricetta che si propone di cambiare e che la cronologia conserva. */
export interface ContenutoRicetta {
  nome: string
  portataSuggerita: string | null
  porzioniBase: number | null
  tempoPreparazioneMin: number | null
  tempoCotturaMin: number | null
  tempoRiposoMin: number | null
  attrezzature: string[]
  procedimento: string[]
  note: string
  fonte: string
  ingredienti: IngredientePiatto[]
}

export const CAMPI_SEMPLICI = ['nome', 'portataSuggerita', 'porzioniBase', 'tempoPreparazioneMin', 'tempoCotturaMin', 'tempoRiposoMin', 'attrezzature', 'procedimento', 'note', 'fonte'] as const
export type CampoSemplice = (typeof CAMPI_SEMPLICI)[number]
export type CampoModifica = CampoSemplice | 'ingrediente' | 'foto'

export const NOMI_CAMPI: Record<CampoModifica, string> = {
  nome: 'Nome',
  portataSuggerita: 'Portata',
  porzioniBase: 'Porzioni',
  tempoPreparazioneMin: 'Tempo di preparazione',
  tempoCotturaMin: 'Tempo di cottura',
  tempoRiposoMin: 'Tempo di riposo',
  attrezzature: 'Attrezzature',
  procedimento: 'Procedimento',
  note: 'Consigli e note',
  fonte: 'Fonte',
  ingrediente: 'Ingrediente',
  foto: 'Foto',
}

export type Operazione = 'modifica' | 'aggiungi' | 'rimuovi'

/** Una modifica proposta: `prima` è il valore ufficiale quando la proposta è nata. */
export interface ModificaProposta {
  id: string
  campo: CampoModifica
  operazione: Operazione
  /** Id dell'ingrediente o della foto. */
  chiave: string | null
  prima: unknown
  dopo: unknown
  /** Un'altra modifica della stessa proposta senza la quale questa non si può applicare. */
  dipendeDa: string | null
}

/** Il contenuto di un ingrediente che conta per il confronto (non l'ordine né l'analisi). */
const sostanza = (i: IngredientePiatto) => ({
  testoOriginale: i.testoOriginale,
  nome: i.nome,
  ingredienteId: i.ingredienteId,
  quantita: i.quantita,
  quantitaMax: i.quantitaMax,
  unita: i.unita,
  scalatura: i.scalatura,
  facoltativo: i.facoltativo,
  nota: i.nota,
})
const uguali = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export const ingredientiUguali = (a: IngredientePiatto, b: IngredientePiatto) => uguali(sostanza(a), sostanza(b))

/**
 * Le modifiche fra il contenuto ufficiale e quello proposto: un elemento per campo cambiato e uno
 * per ingrediente aggiunto, cambiato o tolto (riconosciuto dal suo id). Senza id: nessuna modifica.
 */
export function differenze(ufficiale: ContenutoRicetta, proposto: ContenutoRicetta, nuovoId: () => string): ModificaProposta[] {
  const out: ModificaProposta[] = []
  for (const c of CAMPI_SEMPLICI) {
    if (!uguali(ufficiale[c], proposto[c])) out.push({ id: nuovoId(), campo: c, operazione: 'modifica', chiave: null, prima: ufficiale[c], dopo: proposto[c], dipendeDa: null })
  }
  const attuali = new Map(ufficiale.ingredienti.map((i) => [i.id, i]))
  const nuovi = new Map(proposto.ingredienti.map((i) => [i.id, i]))
  for (const i of proposto.ingredienti) {
    const a = attuali.get(i.id)
    if (!a) out.push({ id: nuovoId(), campo: 'ingrediente', operazione: 'aggiungi', chiave: i.id, prima: null, dopo: i, dipendeDa: null })
    else if (!ingredientiUguali(a, i)) out.push({ id: nuovoId(), campo: 'ingrediente', operazione: 'modifica', chiave: i.id, prima: a, dopo: i, dipendeDa: null })
  }
  for (const a of ufficiale.ingredienti) {
    if (!nuovi.has(a.id)) out.push({ id: nuovoId(), campo: 'ingrediente', operazione: 'rimuovi', chiave: a.id, prima: a, dopo: null, dipendeDa: null })
  }
  return out
}

/**
 * La modifica tocca qualcosa che nel frattempo è cambiato nella ricetta ufficiale? Allora va
 * riesaminata: si applica solo con una decisione esplicita. `foto` è l'elenco delle foto attuali.
 */
export function inConflitto(m: ModificaProposta, ufficiale: ContenutoRicetta, foto: { id: string }[]): boolean {
  if (m.campo === 'foto') return m.operazione === 'rimuovi' && !foto.some((f) => f.id === m.chiave)
  if (m.campo === 'ingrediente') {
    const attuale = ufficiale.ingredienti.find((i) => i.id === m.chiave)
    if (m.operazione === 'aggiungi') return attuale !== undefined
    return !attuale || !ingredientiUguali(attuale, m.prima as IngredientePiatto)
  }
  return !uguali(ufficiale[m.campo], m.prima)
}

/** Applica le modifiche approvate (senza le foto) al contenuto ufficiale di adesso. */
export function applica(ufficiale: ContenutoRicetta, approvate: ModificaProposta[]): ContenutoRicetta {
  const r: ContenutoRicetta = { ...ufficiale, ingredienti: [...ufficiale.ingredienti] }
  for (const m of approvate) {
    if (m.campo === 'foto') continue
    if (m.campo === 'ingrediente') {
      const i = r.ingredienti.findIndex((x) => x.id === m.chiave)
      if (m.operazione === 'rimuovi') {
        if (i >= 0) r.ingredienti.splice(i, 1)
      } else if (i >= 0) r.ingredienti[i] = { ...(m.dopo as IngredientePiatto), ordine: r.ingredienti[i]!.ordine }
      else r.ingredienti.push(m.dopo as IngredientePiatto)
      continue
    }
    ;(r as unknown as Record<string, unknown>)[m.campo] = m.dopo
  }
  r.ingredienti = r.ingredienti.map((x, ordine) => ({ ...x, ordine }))
  return r
}

/**
 * Combinazioni di decisioni non valide: una modifica approvata la cui dipendenza è rifiutata (la
 * foto di un passaggio nuovo senza il nuovo procedimento). Restituisce i nomi dei problemi.
 */
export function dipendenzeMancanti(modifiche: ModificaProposta[], approvate: Set<string>): ModificaProposta[] {
  return modifiche.filter((m) => approvate.has(m.id) && m.dipendeDa !== null && !approvate.has(m.dipendeDa))
}

/** Elenco dei campi cambiati fra due contenuti, per la cronologia (prima → dopo). */
export function campiCambiati(prima: ContenutoRicetta, dopo: ContenutoRicetta): { campo: CampoModifica; prima: unknown; dopo: unknown }[] {
  return differenze(prima, dopo, () => '').map((m) => ({ campo: m.campo, prima: m.prima, dopo: m.dopo }))
}

/** Il contenuto di una ricetta (o di un piatto letto dal database) per proposte e cronologia. */
export function contenutoDi(p: ContenutoRicetta): ContenutoRicetta {
  return {
    nome: p.nome,
    portataSuggerita: p.portataSuggerita,
    porzioniBase: p.porzioniBase,
    tempoPreparazioneMin: p.tempoPreparazioneMin,
    tempoCotturaMin: p.tempoCotturaMin,
    tempoRiposoMin: p.tempoRiposoMin,
    attrezzature: p.attrezzature,
    procedimento: p.procedimento,
    note: p.note,
    fonte: p.fonte,
    ingredienti: p.ingredienti.map((i, ordine) => ({ ...i, ordine })),
  }
}

/** Breve descrizione di un valore per l'interfaccia e le notifiche. */
export function descrivi(campo: CampoModifica, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (campo === 'ingrediente') return (v as IngredientePiatto).testoOriginale || (v as IngredientePiatto).nome
  if (campo === 'foto') return (v as { didascalia?: string }).didascalia || 'foto'
  if (Array.isArray(v)) return v.join(campo === 'procedimento' ? '\n\n' : ', ')
  if (campo.startsWith('tempo')) return `${v} min`
  return String(v)
}
