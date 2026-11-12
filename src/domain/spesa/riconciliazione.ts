// Riconciliazione fra lista calcolata e stati salvati (SPEC §10.3–10.4). Funzione pura.
// «fabbisognoCoperto» è il fabbisogno dichiarato coperto, mai una quantità posseduta.
import { quasiUguali } from '../porzioni.ts'
import { norm } from '../testo.ts'
import type { ArticoloSpesa, Id, StatoSpesa } from '../tipi.ts'
import type { CodiceUnita } from '../unita.ts'
import { identitaDaChiave, type Natura, type Provenienza, type RigaCalcolata } from './calcolo.ts'

export type Sezione = 'da_verificare' | 'da_comprare' | 'facoltativi' | 'ce_lho' | 'comprato' | 'non_piu_necessari' | 'nascosti'
export type Caso = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R7' | 'R8' | 'R9' | 'nuova_facoltativa'

export const ORDINE_SEZIONI: Sezione[] = ['da_verificare', 'da_comprare', 'facoltativi', 'ce_lho', 'comprato', 'non_piu_necessari', 'nascosti']

export interface VoceLista {
  chiave: string
  natura: Natura | 'orfana'
  nome: string
  ingredienteId: Id | null
  repartoId: Id
  /** Reparto scelto a mano dall'utente (override), se c'è. */
  repartoScelto: Id | null
  sezione: Sezione
  caso: Caso
  stato: StatoSpesa
  /** Quantità calcolata ora (unità della riga); null se non sommabile o orfana. */
  quantitaCalcolata: number | null
  /** Quantità mostrata: correzione dell'utente o calcolata. */
  quantita: number | null
  unita: CodiceUnita | null
  fabbisognoCoperto: number | null
  /** R3: fabbisogno in più rispetto a quello dichiarato coperto. */
  aumento: number | null
  /** R4: fabbisogno sceso rispetto a quello dichiarato coperto. */
  diminuzione: number | null
  /** R7: la ricetta è cambiata dopo la correzione dell'utente. */
  correzione: { calcolataOra: number | null; allaCorrezione: number | null } | null
  quantitaUtente: number | null
  nota: string
  nascosto: boolean
  inclusa: boolean
  provenienze: Provenienza[]
  motivi: string[]
  /** Record salvato (0 = nessun record: la riga non è mai stata toccata). */
  articoloId: Id | null
  versione: number
  /** R5: testo del fabbisogno registrato e possibile corrispondenza nuova (R10). */
  descrizioneOrfana: string | null
  trasferibileA: { chiave: string; nome: string } | null
  /** Contributi da verificare dello stesso ingrediente (solo righe sommate). */
  contributiDaVerificare: number
}

export interface VoceManuale {
  id: Id
  nome: string
  quantitaTesto: string
  repartoId: Id | null
  stato: StatoSpesa
  nota: string
  versione: number
  sezione: Sezione
}

export interface ListaSpesa {
  voci: VoceLista[]
  manuali: VoceManuale[]
  contatori: Record<'da_comprare' | 'da_verificare' | 'comprato' | 'ce_lho', number>
}

function haValore(a: ArticoloSpesa): boolean {
  return a.nota.trim() !== '' || a.quantitaUtente !== null || a.repartoId !== null || a.nascosto || a.inclusa
}

const sezioneDaStato = (s: StatoSpesa): Sezione => (s === 'comprato' ? 'comprato' : s === 'ce_lho' ? 'ce_lho' : 'da_comprare')

export function riconciliaSpesa(
  righe: RigaCalcolata[],
  articoli: ArticoloSpesa[],
  opzioni: { ordineReparti: ReadonlyMap<Id, number>; contributiDaVerificare?: ReadonlyMap<string, number> },
): ListaSpesa {
  const salvati = new Map(articoli.filter((a) => a.tipo === 'calcolato' && a.chiave).map((a) => [a.chiave!, a]))
  const usati = new Set<string>()
  const voci: VoceLista[] = []

  for (const r of righe) {
    const a = salvati.get(r.chiave)
    if (a) usati.add(r.chiave)
    const stato: StatoSpesa = a?.stato ?? 'da_comprare'
    const confrontabile = r.natura === 'sommata' || r.natura === 'facoltativa'
    const quantita = confrontabile ? (a?.quantitaUtente ?? r.quantita) : r.quantita
    let caso: Caso = a ? 'R2' : 'R1'
    let sezione: Sezione = sezioneDaStato(stato)
    let aumento: number | null = null
    let diminuzione: number | null = null
    let correzione: VoceLista['correzione'] = null

    if (!confrontabile) {
      caso = 'R9'
      if (r.natura === 'da_verificare' && stato === 'da_comprare') sezione = 'da_verificare'
    } else if ((stato === 'comprato' || stato === 'ce_lho') && a?.fabbisognoCoperto != null && quantita !== null) {
      if (quantita > a.fabbisognoCoperto && !quasiUguali(quantita, a.fabbisognoCoperto)) {
        caso = 'R3'
        aumento = quantita - a.fabbisognoCoperto
        sezione = 'da_comprare'
      } else if (quantita < a.fabbisognoCoperto && !quasiUguali(quantita, a.fabbisognoCoperto)) {
        caso = 'R4'
        diminuzione = a.fabbisognoCoperto - quantita
      }
    }
    if (a?.quantitaUtente != null && confrontabile && a.quantitaCalcolataAllaCorrezione !== r.quantita) {
      const prima = a.quantitaCalcolataAllaCorrezione
      if (prima === null || r.quantita === null || !quasiUguali(prima, r.quantita)) {
        correzione = { calcolataOra: r.quantita, allaCorrezione: prima }
        if (caso === 'R1' || caso === 'R2') caso = 'R7'
      }
    }
    if (r.natura === 'facoltativa' && !a?.inclusa) {
      sezione = 'facoltativi'
      if (caso === 'R1') caso = 'nuova_facoltativa'
    }
    if (a?.nascosto) {
      sezione = 'nascosti'
      caso = 'R8'
    }

    voci.push({
      chiave: r.chiave,
      natura: r.natura,
      nome: r.nome,
      ingredienteId: r.ingredienteId,
      repartoId: a?.repartoId ?? r.repartoId,
      repartoScelto: a?.repartoId ?? null,
      sezione,
      caso,
      stato,
      quantitaCalcolata: r.quantita,
      quantita,
      unita: r.unita,
      fabbisognoCoperto: a?.fabbisognoCoperto ?? null,
      aumento,
      diminuzione,
      correzione,
      quantitaUtente: a?.quantitaUtente ?? null,
      nota: a?.nota ?? '',
      nascosto: a?.nascosto ?? false,
      inclusa: a?.inclusa ?? false,
      provenienze: r.provenienze,
      motivi: r.motivi,
      articoloId: a?.id ?? null,
      versione: a?.versione ?? 0,
      descrizioneOrfana: null,
      trasferibileA: null,
      contributiDaVerificare: r.natura === 'sommata' ? (opzioni.contributiDaVerificare?.get(identitaDaChiave(r.chiave)) ?? 0) : 0,
    })
  }

  // Stati senza riga calcolata: R5 (non più necessari) o R6 (senza valore, non mostrati).
  const nuoveSenzaRecord = voci.filter((v) => v.articoloId === null)
  for (const a of salvati.values()) {
    if (usati.has(a.chiave!)) continue
    const conValore = a.stato !== 'da_comprare' || haValore(a)
    if (!conValore) continue // R6: eliminabile dalla pulizia esplicita, nessuna informazione persa
    const identitaA = identitaDaChiave(a.chiave!)
    const corrispondenza =
      nuoveSenzaRecord.find((v) => !a.chiave!.startsWith('dv:') && identitaDaChiave(v.chiave) === identitaA) ??
      nuoveSenzaRecord.find((v) => a.nome && norm(v.nome) === norm(a.nome))
    voci.push({
      chiave: a.chiave!,
      natura: 'orfana',
      nome: a.nome || 'Articolo',
      ingredienteId: null,
      repartoId: a.repartoId ?? 'rep-altro',
      repartoScelto: a.repartoId,
      sezione: a.nascosto ? 'nascosti' : 'non_piu_necessari',
      caso: a.nascosto ? 'R8' : 'R5',
      stato: a.stato,
      quantitaCalcolata: null,
      quantita: null,
      unita: null,
      fabbisognoCoperto: a.fabbisognoCoperto,
      aumento: null,
      diminuzione: null,
      correzione: null,
      quantitaUtente: a.quantitaUtente,
      nota: a.nota,
      nascosto: a.nascosto,
      inclusa: a.inclusa,
      provenienze: [],
      motivi: [],
      articoloId: a.id,
      versione: a.versione,
      descrizioneOrfana: a.quantitaTesto || null,
      trasferibileA: corrispondenza ? { chiave: corrispondenza.chiave, nome: corrispondenza.nome } : null,
      contributiDaVerificare: 0,
    })
  }

  const manuali: VoceManuale[] = articoli
    .filter((a) => a.tipo === 'manuale')
    .map((a) => ({
      id: a.id,
      nome: a.nome,
      quantitaTesto: a.quantitaTesto,
      repartoId: a.repartoId,
      stato: a.stato,
      nota: a.nota,
      versione: a.versione,
      sezione: sezioneDaStato(a.stato),
    }))

  const ordine = (id: Id | null) => opzioni.ordineReparti.get(id ?? 'rep-altro') ?? 999
  voci.sort((x, y) => ordine(x.repartoId) - ordine(y.repartoId) || x.nome.localeCompare(y.nome, 'it'))
  manuali.sort((x, y) => ordine(x.repartoId) - ordine(y.repartoId) || x.nome.localeCompare(y.nome, 'it'))

  const contatori = {
    da_comprare: voci.filter((v) => v.sezione === 'da_comprare').length + manuali.filter((m) => m.sezione === 'da_comprare').length,
    da_verificare: voci.filter((v) => v.sezione === 'da_verificare').length,
    comprato: voci.filter((v) => v.sezione === 'comprato').length + manuali.filter((m) => m.sezione === 'comprato').length,
    ce_lho: voci.filter((v) => v.sezione === 'ce_lho').length + manuali.filter((m) => m.sezione === 'ce_lho').length,
  }
  return { voci, manuali, contatori }
}

/** Record da eliminare con «Ripulisci» (R6): orfani da comprare senza alcuna informazione. */
export function orfaniSenzaValore(righe: RigaCalcolata[], articoli: ArticoloSpesa[]): ArticoloSpesa[] {
  const chiavi = new Set(righe.map((r) => r.chiave))
  return articoli.filter((a) => a.tipo === 'calcolato' && a.chiave && !chiavi.has(a.chiave) && a.stato === 'da_comprare' && !haValore(a))
}
