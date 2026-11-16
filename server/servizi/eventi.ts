// Casi d'uso di eventi, portate e voci di menù (SPEC §7.1–7.3, §7.8, §12.5).
import type { AggiornaEvento, AggiornaVoce, Menu, NuovaVoce, NuovoEvento, RiepilogoEvento, RiordinoVoci } from '../../src/contratto/eventi.ts'
import { copertiEquivalenti, porzioniEffettive } from '../../src/domain/porzioni.ts'
import { modificabile, statoDopo } from '../../src/domain/regole/evento.ts'
import { norm, pulisci } from '../../src/domain/testo.ts'
import type { Evento, StatoEvento, VoceMenu } from '../../src/domain/tipi.ts'
import { type Db, esegui, lettura, transazione } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repo from '../db/repo/eventi.ts'
import * as repoFamiglia from '../db/repo/famiglia.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { nonTrovato, regolaViolata, richiestaNonValida } from './errori.ts'
import { leggiImpostazioni } from './impostazioni.ts'
import { aggiornaConVersione, controllaVersione, controllaVersioni, creaIdempotente, eliminaConVersione } from './versioni.ts'

export function leggiEvento(db: Db, id: string): Evento {
  const e = repo.leggiEvento(db, id)
  if (!e) throw nonTrovato('Evento')
  return e
}

/** Rifiuta le modifiche a un evento archiviato (SPEC §6.4). */
export function richiediModificabile(e: Evento): void {
  if (!modificabile(e.stato)) {
    throw regolaViolata('evento_archiviato', 'L\'evento è archiviato: riaprilo per modificarlo')
  }
}

export function elencaEventi(db: Db, utenteId: string, stato?: StatoEvento): RiepilogoEvento[] {
  return lettura(db, () => repo.elencaEventi(db, utenteId, stato).map((e) => ({ ...e, copertiEquivalenti: copertiEquivalenti(e) })))
}

function nomiPortateUnici(portate: { nome: string }[]): void {
  const nomi = portate.map((p) => norm(p.nome))
  if (new Set(nomi).size !== nomi.length) throw richiestaNonValida('Due portate hanno lo stesso nome')
}

export function creaEvento(db: Db, d: NuovoEvento, proprietarioId: string, adesso = Date.now()): { creato: boolean; valore: Evento } {
  return transazione(db, () => {
    const imp = leggiImpostazioni(db)
    const portate = (d.portate ?? imp.portatePredefinite.map((p) => ({ id: `${d.id}:${p.id}`, nome: p.nome }))).map((p, i) => ({
      id: p.id,
      nome: pulisci(p.nome),
      ordine: i,
    }))
    nomiPortateUnici(portate)
    const dati = {
      id: d.id,
      nome: pulisci(d.nome),
      data: d.data,
      oraServizio: d.oraServizio,
      tipo: d.tipo,
      occasione: pulisci(d.occasione),
      adulti: d.adulti,
      bambini: d.bambini,
      coefficienteBambini: d.coefficienteBambini ?? imp.coefficienteBambini,
      note: d.note,
    }
    const esito = creaIdempotente(
      db,
      'eventi',
      d.id,
      () => repo.leggiEvento(db, d.id),
      // Ripetizione della stessa creazione solo se l'evento è dello stesso utente.
      (e) =>
        e.nome === dati.nome && e.data === dati.data && e.tipo === dati.tipo && e.adulti === dati.adulti && e.bambini === dati.bambini &&
        repoAccesso.proprietarioEvento(db, d.id) === proprietarioId,
      () => {
        repo.inserisciEvento(db, { ...dati, stato: 'attivo', conclusoIl: null, archiviatoIl: null, creatoIl: adesso, aggiornatoIl: adesso }, proprietarioId)
        portate.forEach((p) => repo.inserisciPortata(db, d.id, p))
      },
    )
    if (esito.creato) incrementaRevisione(db)
    return esito
  })
}

export function aggiornaEvento(db: Db, id: string, d: AggiornaEvento, adesso = Date.now()): Evento {
  nomiPortateUnici(d.portate)
  return transazione(db, () => {
    const attuale = leggiEvento(db, id)
    richiediModificabile(attuale)
    aggiornaConVersione(
      db,
      'eventi',
      id,
      d.versione,
      {
        nome: pulisci(d.nome),
        data: d.data,
        ora_servizio: d.oraServizio,
        tipo: d.tipo,
        occasione: pulisci(d.occasione),
        adulti: d.adulti,
        bambini: d.bambini,
        coefficiente_bambini: d.coefficienteBambini,
        note: d.note,
      },
      () => leggiEvento(db, id),
      adesso,
    )
    // Portate: rinomina, riordina, aggiunge; elimina solo quelle vuote (FK RESTRICT).
    const esistenti = new Map(attuale.portate.map((p) => [p.id, p]))
    const nuove = new Set(d.portate.map((p) => p.id))
    for (const p of attuale.portate) {
      if (!nuove.has(p.id)) {
        const n = repo.contaVociPortata(db, p.id)
        if (n > 0) {
          throw regolaViolata('portata_non_vuota', `La portata «${p.nome}» contiene ${n} voci: spostale prima di eliminarla`, { portataId: p.id })
        }
        repo.eliminaPortata(db, p.id)
      }
    }
    // Ordini temporanei negativi non ammessi dal CHECK: si scrivono direttamente quelli finali.
    d.portate.forEach((p, i) => {
      const dati = { id: p.id, nome: pulisci(p.nome), ordine: i }
      if (esistenti.has(p.id)) repo.aggiornaPortata(db, dati)
      else {
        try {
          repo.inserisciPortata(db, id, dati)
        } catch {
          throw richiestaNonValida('Identificativo di portata già usato')
        }
      }
    })
    incrementaRevisione(db)
    return leggiEvento(db, id)
  })
}

export function eliminaEvento(db: Db, id: string, versione: number): void {
  transazione(db, () => {
    eliminaConVersione(db, 'eventi', id, versione, () => leggiEvento(db, id))
    incrementaRevisione(db)
  })
}

/** Concludi / riapri (concluso → attivo). Archiviazione e riapertura dall'archivio: servizi/archivio.ts. */
export function cambiaStato(db: Db, id: string, azione: 'concludi' | 'riapri', versione: number, adesso = Date.now()): Evento {
  return transazione(db, () => {
    const e = leggiEvento(db, id)
    controllaVersione(db, 'eventi', id, versione, () => e)
    if (azione === 'riapri' && e.stato === 'archiviato') {
      throw regolaViolata('usa_riapri_archivio', 'Per riaprire un evento archiviato usa la riapertura dall\'archivio')
    }
    const nuovo = statoDopo(azione, e.stato)
    if (!nuovo) throw regolaViolata('transizione_non_ammessa', `Non si può ${azione === 'concludi' ? 'concludere' : 'riaprire'} un evento ${e.stato}`)
    aggiornaConVersione(db, 'eventi', id, versione, { stato: nuovo, concluso_il: nuovo === 'concluso' ? adesso : null }, () => e, adesso)
    incrementaRevisione(db)
    return leggiEvento(db, id)
  })
}

// ── Menù ────────────────────────────────────────────────────

export function leggiMenu(db: Db, eventoId: string): Menu {
  return lettura(db, () => {
    const evento = leggiEvento(db, eventoId)
    const coperti = copertiEquivalenti(evento)
    const voci = repo.vociEvento(db, eventoId)
    return {
      evento,
      copertiEquivalenti: coperti,
      portate: evento.portate.map((p) => ({
        ...p,
        voci: voci.filter((v) => v.portataId === p.id).map((v) => ({ ...v, porzioniEffettive: porzioniEffettive(v, coperti) })),
      })),
    }
  })
}

/**
 * Piatto da collegare a una voce: `risolvi` verifica che l'utente possa usarlo e restituisce
 * il piatto del proprietario dell'evento (eventualmente una copia, SPEC §19.4).
 */
export type RisolviPiatto = (piattoId: string) => string

function controllaPiatto(db: Db, piattoId: string | null | undefined, risolvi: RisolviPiatto): string | null {
  if (!piattoId) return null
  if (!repo.piattoEsiste(db, piattoId)) throw regolaViolata('piatto_inesistente', 'Il piatto collegato non esiste più')
  return risolvi(piattoId)
}

/** Crea una o più voci (inserimento rapido multiriga). Ripetizioni con lo stesso id: idempotenti. */
export function creaVoci(db: Db, eventoId: string, voci: NuovaVoce[], risolvi: RisolviPiatto, adesso = Date.now()): VoceMenu[] {
  return transazione(db, () => {
    const e = leggiEvento(db, eventoId)
    richiediModificabile(e)
    const risultato: VoceMenu[] = []
    let create = 0
    for (const v of voci) {
      if (!repo.portataDiEvento(db, eventoId, v.portataId)) throw richiestaNonValida('La portata non appartiene a questo evento')
      const piattoId = controllaPiatto(db, v.piattoId, risolvi)
      const dati = {
        nome: pulisci(v.nome),
        piattoId,
        porzioni: v.porzioni ?? null,
        incaricato: pulisci(v.incaricato ?? ''),
        inSpesa: v.inSpesa ?? true,
        note: v.note ?? '',
      }
      const esito = creaIdempotente(
        db,
        'voci_menu',
        v.id,
        () => repo.leggiVoce(db, v.id),
        (x) => x.eventoId === eventoId && x.nome === dati.nome && x.portataId === v.portataId,
        () => {
          const ordinate = repo.vociPortata(db, v.portataId).map((x) => x.id)
          const posizione = v.ordine === undefined ? ordinate.length : Math.min(v.ordine, ordinate.length)
          repo.inserisciVoce(db, { id: v.id, eventoId, portataId: v.portataId, ordine: ordinate.length, ...dati, creatoIl: adesso, aggiornatoIl: adesso })
          ordinate.splice(posizione, 0, v.id)
          repo.scriviOrdine(db, v.portataId, ordinate, adesso, new Set())
        },
      )
      if (esito.creato) create++
      risultato.push(repo.leggiVoce(db, v.id)!)
    }
    if (create > 0) incrementaRevisione(db)
    return risultato
  })
}

export function leggiVoce(db: Db, id: string): VoceMenu {
  const v = repo.leggiVoce(db, id)
  if (!v) throw nonTrovato('Voce di menù')
  return v
}

export function aggiornaVoce(db: Db, id: string, d: AggiornaVoce, risolvi: RisolviPiatto, adesso = Date.now()): VoceMenu {
  return transazione(db, () => {
    const v = leggiVoce(db, id)
    richiediModificabile(leggiEvento(db, v.eventoId))
    // Lo stesso piatto già collegato non passa di nuovo dalla verifica (resta com'è).
    const piattoId = d.piattoId === v.piattoId ? v.piattoId : controllaPiatto(db, d.piattoId, risolvi)
    aggiornaConVersione(
      db,
      'voci_menu',
      id,
      d.versione,
      { nome: pulisci(d.nome), piatto_id: piattoId, porzioni: d.porzioni, incaricato: pulisci(d.incaricato), in_spesa: d.inSpesa, note: d.note },
      () => leggiVoce(db, id),
      adesso,
    )
    repoFamiglia.allineaIncaricato(db, id)
    incrementaRevisione(db)
    return leggiVoce(db, id)
  })
}

export function eliminaVoce(db: Db, id: string, versione: number): void {
  transazione(db, () => {
    const v = leggiVoce(db, id)
    richiediModificabile(leggiEvento(db, v.eventoId))
    eliminaConVersione(db, 'voci_menu', id, versione, () => leggiVoce(db, id))
    repo.scriviOrdine(db, v.portataId, repo.vociPortata(db, v.portataId).map((x) => x.id), Date.now(), new Set())
    incrementaRevisione(db)
  })
}

/**
 * Ordine completo di una portata. Le voci che arrivano da un'altra portata vengono
 * spostate; la portata di provenienza viene ricompattata.
 */
export function riordinaVoci(db: Db, eventoId: string, d: RiordinoVoci, adesso = Date.now()): Menu {
  return transazione(db, () => {
    const e = leggiEvento(db, eventoId)
    richiediModificabile(e)
    if (!repo.portataDiEvento(db, eventoId, d.portataId)) throw richiestaNonValida('La portata non appartiene a questo evento')
    controllaVersioni(db, 'voci_menu', d.voci, () => leggiMenu(db, eventoId))
    const ids = d.voci.map((v) => v.id)
    if (new Set(ids).size !== ids.length) throw richiestaNonValida('Voce ripetuta nell\'ordine')
    const attuali = repo.vociPortata(db, d.portataId).map((v) => v.id)
    const mancanti = attuali.filter((id) => !ids.includes(id))
    if (mancanti.length > 0) throw richiestaNonValida('L\'ordine deve contenere tutte le voci della portata')
    const spostate = new Set<string>()
    const provenienze = new Set<string>()
    for (const id of ids) {
      const v = repo.leggiVoce(db, id)!
      if (v.eventoId !== eventoId) throw richiestaNonValida('Voce di un altro evento')
      if (v.portataId !== d.portataId) {
        spostate.add(id)
        provenienze.add(v.portataId)
      }
    }
    // Le voci spostate cambiano portata (versione incrementata); le altre solo ordine.
    repo.scriviOrdine(db, d.portataId, ids, adesso, spostate)
    for (const p of provenienze) repo.scriviOrdine(db, p, repo.vociPortata(db, p).map((v) => v.id), adesso, new Set())
    incrementaRevisione(db)
    return leggiMenu(db, eventoId)
  })
}

/** Usato dai test: forza lo stato senza passare dalle regole. */
export function _impostaStato(db: Db, id: string, stato: StatoEvento): void {
  esegui(db, 'UPDATE eventi SET stato = ?, archiviato_il = ? WHERE id = ?', stato, stato === 'archiviato' ? Date.now() : null, id)
}
