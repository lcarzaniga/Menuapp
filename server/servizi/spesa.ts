// Casi d'uso della spesa: calcolo sul server, stati e fabbisogno coperto (SPEC §10).
import { randomUUID } from 'node:crypto'
import type { AggiornaRiga, RispostaSpesa } from '../../src/contratto/spesa.ts'
import { calcolaSpesa, contributiDaVerificare, type DatiCalcolo, type RigaCalcolata } from '../../src/domain/spesa/calcolo.ts'
import { orfaniSenzaValore, riconciliaSpesa } from '../../src/domain/spesa/riconciliazione.ts'
import { pulisci } from '../../src/domain/testo.ts'
import type { ArticoloSpesa, StatoSpesa } from '../../src/domain/tipi.ts'
import { formattaQuantita } from '../../src/domain/unita.ts'
import { type Db, lettura, transazione } from '../db/connessione.ts'
import * as repoEventi from '../db/repo/eventi.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import * as repo from '../db/repo/spesa.ts'
import { conflittoVersione, nonTrovato, regolaViolata, richiestaNonValida } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'
import { elencaReparti, leggiReparto } from './impostazioni.ts'
import { aggiornaConVersione, creaIdempotente, eliminaConVersione } from './versioni.ts'
import { spesaDaSnapshot } from './archivio.ts'

export interface Calcolo {
  righe: RigaCalcolata[]
  avvisi: ReturnType<typeof calcolaSpesa>['avvisi']
  copertiEquivalenti: number
  dati: DatiCalcolo
}

/** Raccoglie i dati di un evento e calcola la lista (in una transazione di lettura). */
export function calcolaPerEvento(db: Db, eventoId: string): Calcolo {
  const evento = leggiEvento(db, eventoId)
  const voci = repoEventi.vociEvento(db, eventoId)
  const piatti = repoRic.leggiPiatti(db, voci.map((v) => v.piattoId).filter((x): x is string => x !== null))
  const catalogo = new Map(repoRic.elencaIngredienti(db).map((i) => [i.id, { id: i.id, nome: i.nome, repartoId: i.repartoId }]))
  const dati: DatiCalcolo = { evento, voci, piatti, catalogo }
  const r = calcolaSpesa(dati)
  return { ...r, dati }
}

export function ordineReparti(db: Db): Map<string, number> {
  return new Map(elencaReparti(db).map((r, i) => [r.id, i]))
}

export function listaSpesa(db: Db, eventoId: string): RispostaSpesa {
  return lettura(db, () => {
    const evento = leggiEvento(db, eventoId)
    if (evento.stato === 'archiviato') return spesaDaSnapshot(db, eventoId)
    const c = calcolaPerEvento(db, eventoId)
    const lista = riconciliaSpesa(c.righe, repo.articoliEvento(db, eventoId), {
      ordineReparti: ordineReparti(db),
      contributiDaVerificare: contributiDaVerificare(c.righe, c.dati),
    })
    return { ...lista, avvisi: c.avvisi, copertiEquivalenti: c.copertiEquivalenti, solaLettura: false }
  })
}

const famigliaChiave = (chiave: string) => chiave.split('|').slice(1).join('|')

const coperto = (s: StatoSpesa) => s === 'comprato' || s === 'ce_lho'

/**
 * Aggiorna stato e interventi di una riga calcolata. Il fabbisogno coperto lo stabilisce
 * il server dalla lista attuale, mai il client (che potrebbe mostrare una lista vecchia).
 */
export function aggiornaRiga(db: Db, eventoId: string, chiave: string, d: AggiornaRiga, adesso = Date.now()): ArticoloSpesa {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    const c = calcolaPerEvento(db, eventoId)
    const riga = c.righe.find((r) => r.chiave === chiave)
    const esistente = repo.articoloPerChiave(db, eventoId, chiave)
    if (!riga && !esistente) throw nonTrovato('Riga della spesa')
    if (d.repartoId && !leggiReparto(db, d.repartoId)) throw richiestaNonValida('Reparto inesistente')

    const confrontabile = riga !== undefined && (riga.natura === 'sommata' || riga.natura === 'facoltativa')
    const quantitaUtente = confrontabile ? d.quantitaUtente : null
    const mostrata = confrontabile ? (quantitaUtente ?? riga.quantita) : null

    let fabbisognoCoperto: number | null = null
    if (coperto(d.stato) && mostrata !== null) {
      const appenaCoperto = !esistente || !coperto(esistente.stato)
      fabbisognoCoperto = appenaCoperto || d.aggiornaCopertura ? mostrata : (esistente.fabbisognoCoperto ?? mostrata)
    }
    let quantitaCalcolataAllaCorrezione: number | null = null
    if (quantitaUtente !== null) {
      quantitaCalcolataAllaCorrezione =
        esistente?.quantitaUtente === quantitaUtente && d.aggiornaCopertura !== true ? esistente.quantitaCalcolataAllaCorrezione : (riga?.quantita ?? null)
    }
    const unita = riga?.unita ?? null
    const riferimento = fabbisognoCoperto ?? mostrata
    const dati: repo.DatiArticolo = {
      stato: d.stato,
      fabbisognoCoperto,
      quantitaUtente,
      quantitaCalcolataAllaCorrezione,
      repartoId: d.repartoId,
      nascosto: d.nascosto,
      inclusa: d.inclusa,
      nota: pulisci(d.nota),
      nome: riga?.nome ?? esistente?.nome ?? '',
      quantitaTesto: riga ? (riferimento !== null ? formattaQuantita(riferimento, unita, 'spesa').testo : unita === 'qb' ? 'q.b.' : '') : (esistente?.quantitaTesto ?? ''),
    }
    if (d.versione === 0) {
      if (esistente) throw conflittoVersione(esistente)
      repo.inserisciArticolo(db, randomUUID(), eventoId, 'calcolato', chiave, dati, adesso)
    } else {
      if (!esistente) throw conflittoVersione(null)
      aggiornaConVersione(db, 'articoli_spesa', esistente.id, d.versione, repo.colonne(dati), () => repo.leggiArticolo(db, esistente.id), adesso)
    }
    incrementaRevisione(db)
    return repo.articoloPerChiave(db, eventoId, chiave)!
  })
}

/** R5 «Rimuovi»: elimina lo stato di una riga non più necessaria. */
export function eliminaRiga(db: Db, eventoId: string, chiave: string, versione: number): void {
  transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    const a = repo.articoloPerChiave(db, eventoId, chiave)
    if (!a) throw nonTrovato('Riga della spesa')
    eliminaConVersione(db, 'articoli_spesa', a.id, versione, () => repo.leggiArticolo(db, a.id))
    incrementaRevisione(db)
  })
}

/** R6 «Ripulisci»: elimina solo gli stati senza alcuna informazione. */
export function ripulisci(db: Db, eventoId: string): { eliminati: number } {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    const c = calcolaPerEvento(db, eventoId)
    const orfani = orfaniSenzaValore(c.righe, repo.articoliEvento(db, eventoId))
    orfani.forEach((o) => repo.eliminaArticolo(db, o.id))
    if (orfani.length) incrementaRevisione(db)
    return { eliminati: orfani.length }
  })
}

/** R10 «Trasferisci lo stato»: sposta stato, nota e fabbisogno coperto sulla nuova chiave. */
export function trasferisci(db: Db, eventoId: string, da: string, a: string, versione: number, adesso = Date.now()): ArticoloSpesa {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    const origine = repo.articoloPerChiave(db, eventoId, da)
    if (!origine) throw nonTrovato('Riga della spesa')
    if (origine.versione !== versione) throw conflittoVersione(origine)
    const c = calcolaPerEvento(db, eventoId)
    const destinazione = c.righe.find((r) => r.chiave === a)
    if (!destinazione) throw regolaViolata('destinazione_assente', 'La riga di destinazione non è più nella lista')
    if (repo.articoloPerChiave(db, eventoId, a)) throw regolaViolata('destinazione_occupata', 'La riga di destinazione ha già uno stato')
    repo.inserisciArticolo(
      db,
      randomUUID(),
      eventoId,
      'calcolato',
      a,
      {
        stato: origine.stato,
        // Il fabbisogno coperto ha senso solo nella stessa famiglia di unità: grammi e confezioni non si confrontano.
        fabbisognoCoperto:
          coperto(origine.stato) && (destinazione.natura === 'sommata' || destinazione.natura === 'facoltativa') && famigliaChiave(da) === famigliaChiave(a)
            ? (origine.fabbisognoCoperto ?? null)
            : null,
        quantitaUtente: null,
        quantitaCalcolataAllaCorrezione: null,
        repartoId: origine.repartoId,
        nascosto: false,
        inclusa: origine.inclusa,
        nota: origine.nota,
        nome: destinazione.nome,
        quantitaTesto: origine.quantitaTesto,
      },
      adesso,
    )
    repo.eliminaArticolo(db, origine.id)
    incrementaRevisione(db)
    return repo.articoloPerChiave(db, eventoId, a)!
  })
}

// ── Articoli manuali ────────────────────────────────────────

export function creaManuale(
  db: Db,
  eventoId: string,
  d: { id: string; nome: string; quantitaTesto: string; repartoId: string | null; nota: string },
  adesso = Date.now(),
): { creato: boolean; valore: ArticoloSpesa } {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    if (d.repartoId && !leggiReparto(db, d.repartoId)) throw richiestaNonValida('Reparto inesistente')
    const nome = pulisci(d.nome)
    const esito = creaIdempotente(
      db,
      'articoli_spesa',
      d.id,
      () => repo.leggiArticolo(db, d.id),
      (x) => x.eventoId === eventoId && x.nome === nome,
      () =>
        repo.inserisciArticolo(db, d.id, eventoId, 'manuale', null, {
          stato: 'da_comprare', fabbisognoCoperto: null, quantitaUtente: null, quantitaCalcolataAllaCorrezione: null,
          repartoId: d.repartoId, nascosto: false, inclusa: false, nota: pulisci(d.nota), nome, quantitaTesto: pulisci(d.quantitaTesto),
        }, adesso),
    )
    if (esito.creato) incrementaRevisione(db)
    return esito
  })
}

function leggiManuale(db: Db, id: string): ArticoloSpesa {
  const a = repo.leggiArticolo(db, id)
  if (!a || a.tipo !== 'manuale') throw nonTrovato('Articolo')
  return a
}

export function aggiornaManuale(
  db: Db,
  id: string,
  d: { nome: string; quantitaTesto: string; repartoId: string | null; nota: string; stato: StatoSpesa; versione: number },
): ArticoloSpesa {
  return transazione(db, () => {
    const a = leggiManuale(db, id)
    richiediModificabile(leggiEvento(db, a.eventoId))
    if (d.repartoId && !leggiReparto(db, d.repartoId)) throw richiestaNonValida('Reparto inesistente')
    aggiornaConVersione(
      db,
      'articoli_spesa',
      id,
      d.versione,
      { nome: pulisci(d.nome), quantita_testo: pulisci(d.quantitaTesto), reparto_id: d.repartoId, nota: pulisci(d.nota), stato: d.stato },
      () => repo.leggiArticolo(db, id),
    )
    incrementaRevisione(db)
    return leggiManuale(db, id)
  })
}

export function eliminaManuale(db: Db, id: string, versione: number): void {
  transazione(db, () => {
    const a = leggiManuale(db, id)
    richiediModificabile(leggiEvento(db, a.eventoId))
    eliminaConVersione(db, 'articoli_spesa', id, versione, () => repo.leggiArticolo(db, id))
    incrementaRevisione(db)
  })
}
