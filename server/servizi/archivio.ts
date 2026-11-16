// Archiviazione con snapshot autonomo, consultazione, riapertura, copia nel ricettario (SPEC §7.3–7.4).
import { randomUUID } from 'node:crypto'
import { type ContenutoSnapshot, type InfoRiapertura, type Snapshot, VERSIONE_FORMATO_SNAPSHOT } from '../../src/contratto/archivio.ts'
import type { Menu } from '../../src/contratto/eventi.ts'
import type { RispostaSpesa } from '../../src/contratto/spesa.ts'
import { contributiDaVerificare } from '../../src/domain/spesa/calcolo.ts'
import { riconciliaSpesa } from '../../src/domain/spesa/riconciliazione.ts'
import type { Attivita, Evento } from '../../src/domain/tipi.ts'
import { type Db, esegui, transazione, tutti, uno } from '../db/connessione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import * as repoSpesa from '../db/repo/spesa.ts'
import * as repoStampa from '../db/repo/stampa.ts'
import { elencaAttivita } from './attivita.ts'
import { nonTrovato, regolaViolata } from './errori.ts'
import { leggiEvento, leggiMenu } from './eventi.ts'
import { elencaReparti } from './impostazioni.ts'
import { perArchivio } from './partecipanti.ts'
import { creaPiatto } from './ricettario.ts'
import { calcolaPerEvento, ordineReparti } from './spesa.ts'
import { controllaVersione } from './versioni.ts'

interface RigaSnapshot {
  id: string
  evento_id: string
  stato: 'valido' | 'superato'
  versione_formato: number
  contenuto: string
  creato_il: number
  superato_il: number | null
}

const daRiga = (r: RigaSnapshot): Snapshot => ({
  id: r.id,
  eventoId: r.evento_id,
  stato: r.stato,
  versioneFormato: r.versione_formato,
  creatoIl: r.creato_il,
  superatoIl: r.superato_il,
  contenuto: JSON.parse(r.contenuto) as ContenutoSnapshot,
})

export function snapshotValido(db: Db, eventoId: string): Snapshot | undefined {
  const r = uno<RigaSnapshot>(db, "SELECT * FROM snapshot_eventi WHERE evento_id = ? AND stato = 'valido'", eventoId)
  return r ? daRiga(r) : undefined
}

export function elencaSnapshot(db: Db, eventoId: string): Snapshot[] {
  return tutti<RigaSnapshot>(db, 'SELECT * FROM snapshot_eventi WHERE evento_id = ? ORDER BY creato_il DESC', eventoId).map(daRiga)
}

export function leggiSnapshot(db: Db, id: string): Snapshot {
  const r = uno<RigaSnapshot>(db, 'SELECT * FROM snapshot_eventi WHERE id = ?', id)
  if (!r) throw nonTrovato('Versione archiviata')
  return daRiga(r)
}

function richiediSnapshot(db: Db, eventoId: string): Snapshot {
  const s = snapshotValido(db, eventoId)
  if (!s) throw nonTrovato('Versione archiviata')
  return s
}

/** Costruisce il contenuto autonomo dello snapshot dai dati vivi dell'evento. */
export function costruisciSnapshot(db: Db, eventoId: string): ContenutoSnapshot {
  const evento = leggiEvento(db, eventoId)
  const menu = leggiMenu(db, eventoId)
  const c = calcolaPerEvento(db, eventoId)
  const reparti = elencaReparti(db)
  const nomeReparto = new Map(reparti.map((r) => [r.id, r.nome]))
  const lista = riconciliaSpesa(c.righe, repoSpesa.articoliEvento(db, eventoId), {
    ordineReparti: ordineReparti(db),
    contributiDaVerificare: contributiDaVerificare(c.righe, c.dati),
  })
  const piatti = [...c.dati.piatti.values()].map(({ versione: _v, creatoIl: _c, aggiornatoIl: _a, ...p }) => ({
    ...p,
    ingredienti: p.ingredienti.map((i) => {
      const cat = i.ingredienteId ? c.dati.catalogo.get(i.ingredienteId) : undefined
      return { ...i, ingredienteNome: cat?.nome ?? null, repartoNome: cat ? (nomeReparto.get(cat.repartoId) ?? null) : null }
    }),
  }))
  const { versione: _v, creatoIl: _c, aggiornatoIl: _a, ...datiEvento } = evento
  const stile = repoStampa.leggiStile(db, eventoId)
  return {
    evento: datiEvento,
    copertiEquivalenti: menu.copertiEquivalenti,
    menu: menu.portate,
    piatti,
    spesa: { ...lista, avvisi: c.avvisi, copertiEquivalenti: c.copertiEquivalenti, solaLettura: true },
    reparti: reparti.map((r) => ({ id: r.id, nome: r.nome })),
    attivita: elencaAttivita(db, eventoId).map(({ versione: _x, creatoIl: _y, aggiornatoIl: _z, ...a }) => a),
    stampa: stile ? (JSON.parse(stile.opzioni) as ContenutoSnapshot['stampa']) : null,
    partecipanti: perArchivio(db, eventoId),
  }
}

export function archivia(db: Db, eventoId: string, versione: number, adesso = Date.now()): Evento {
  return transazione(db, () => {
    const e = leggiEvento(db, eventoId)
    controllaVersione(db, 'eventi', eventoId, versione, () => e)
    if (e.stato === 'archiviato') throw regolaViolata('transizione_non_ammessa', 'L\'evento è già archiviato')
    const contenuto = costruisciSnapshot(db, eventoId)
    contenuto.evento = { ...contenuto.evento, stato: 'archiviato', archiviatoIl: adesso }
    esegui(
      db,
      "INSERT INTO snapshot_eventi (id, evento_id, stato, versione_formato, contenuto, creato_il) VALUES (?, ?, 'valido', ?, ?, ?)",
      randomUUID(), eventoId, VERSIONE_FORMATO_SNAPSHOT, JSON.stringify(contenuto), adesso,
    )
    esegui(db, "UPDATE eventi SET stato = 'archiviato', archiviato_il = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?", adesso, adesso, eventoId)
    incrementaRevisione(db)
    return leggiEvento(db, eventoId)
  })
}

/** Piatti dello snapshot cambiati o eliminati dopo l'archiviazione (solo informazione). */
export function infoRiapertura(db: Db, eventoId: string): InfoRiapertura {
  const s = richiediSnapshot(db, eventoId)
  const piattiCambiati: InfoRiapertura['piattiCambiati'] = []
  for (const p of s.contenuto.piatti) {
    const vivo = repoRic.leggiPiatto(db, p.id)
    if (!vivo) piattiCambiati.push({ dishId: p.id, nome: p.nome, esito: 'eliminato' })
    else if (vivo.aggiornatoIl > s.creatoIl) piattiCambiati.push({ dishId: p.id, nome: p.nome, esito: 'modificato' })
  }
  return { piattiCambiati }
}

/** Riapertura semplice: l'evento torna attivo con le ricette attuali; lo snapshot resta come storico. */
export function riapriArchiviato(db: Db, eventoId: string, versione: number, adesso = Date.now()): Evento {
  return transazione(db, () => {
    const e = leggiEvento(db, eventoId)
    controllaVersione(db, 'eventi', eventoId, versione, () => e)
    if (e.stato !== 'archiviato') throw regolaViolata('transizione_non_ammessa', 'L\'evento non è archiviato')
    esegui(db, "UPDATE snapshot_eventi SET stato = 'superato', superato_il = ? WHERE evento_id = ? AND stato = 'valido'", adesso, eventoId)
    esegui(db, "UPDATE eventi SET stato = 'attivo', archiviato_il = NULL, concluso_il = NULL, versione = versione + 1, aggiornato_il = ? WHERE id = ?", adesso, eventoId)
    incrementaRevisione(db)
    return leggiEvento(db, eventoId)
  })
}

/** «Copia nel ricettario»: nuovo piatto dai dati dello snapshot; non tocca i piatti esistenti. */
export function copiaPiattoDaSnapshot(db: Db, snapshotId: string, piattoId: string, nuovoId: string, proprietarioId: string) {
  return transazione(db, () => {
    const s = leggiSnapshot(db, snapshotId)
    const p = s.contenuto.piatti.find((x) => x.id === piattoId)
    if (!p) throw nonTrovato('Piatto nella versione archiviata')
    const catalogoVivo = new Set(repoRic.elencaIngredienti(db).map((i) => i.id))
    return creaPiatto(db, {
      id: nuovoId,
      nome: `${p.nome} (${s.contenuto.evento.nome})`.slice(0, 200),
      portataSuggerita: p.portataSuggerita,
      porzioniBase: p.porzioniBase,
      tempoPreparazioneMin: p.tempoPreparazioneMin,
      tempoCotturaMin: p.tempoCotturaMin,
      tempoRiposoMin: p.tempoRiposoMin,
      attrezzature: p.attrezzature,
      procedimento: p.procedimento,
      note: p.note,
      fonte: p.fonte,
      ingredienti: p.ingredienti.map(({ ingredienteNome: _n, repartoNome: _r, ...i }) => ({
        ...i,
        id: randomUUID(),
        ingredienteId: i.ingredienteId && catalogoVivo.has(i.ingredienteId) ? i.ingredienteId : null,
      })),
    }, { proprietarioId }).valore
  })
}

// ── Lettura da snapshot (evento archiviato) ────────────────

export function spesaDaSnapshot(db: Db, eventoId: string): RispostaSpesa {
  return { ...richiediSnapshot(db, eventoId).contenuto.spesa, solaLettura: true }
}

/** Gli snapshot precedenti ai partecipanti (§24) non hanno la modalità dei coperti: erano manuali. */
export function eventoDaSnapshot(e: ContenutoSnapshot['evento']): ContenutoSnapshot['evento'] {
  return { ...e, copertiAutomatici: e.copertiAutomatici ?? false, copertiManuali: e.copertiManuali ?? { adulti: e.adulti, bambini: e.bambini }, maxAccompagnatori: e.maxAccompagnatori ?? null, serieId: e.serieId ?? null }
}

export function menuDaSnapshot(db: Db, eventoId: string): Menu {
  const s = richiediSnapshot(db, eventoId)
  const vivo = leggiEvento(db, eventoId)
  return { evento: { ...eventoDaSnapshot(s.contenuto.evento), versione: vivo.versione, creatoIl: vivo.creatoIl, aggiornatoIl: vivo.aggiornatoIl }, copertiEquivalenti: s.contenuto.copertiEquivalenti, portate: s.contenuto.menu }
}

export function attivitaDaSnapshot(db: Db, eventoId: string): Attivita[] {
  return richiediSnapshot(db, eventoId).contenuto.attivita.map((a) => ({ ...a, versione: 0, creatoIl: 0, aggiornatoIl: 0 }))
}
